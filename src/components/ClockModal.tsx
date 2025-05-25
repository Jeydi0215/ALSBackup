import { useState, useRef, useEffect } from "react";
import styles from "../css/ClockModal.module.css";
import Calendar from "../assets/calendar.png";
import Close from "../assets/close.png";

import { ref, uploadString, getDownloadURL } from "firebase/storage";
import { imageDb } from "../firebase";

import * as faceapi from "face-api.js";
import { getOpenCageKey } from '../utils/apiKeys';

type Props = {
  handleCameraClick: () => void;
  showCamera: boolean;
  onSubmitClockLog: (
    image: string, 
    timestamp: string, 
    imageUrl?: string,
    location?: {
      latitude: number;
      longitude: number;
      address?: string;
    }
  ) => void;
};

const ClockModal = ({ handleCameraClick, showCamera, onSubmitClockLog }: Props) => {
  const [shareLocation, setShareLocation] = useState(false);
  const [location, setLocation] = useState<{
    latitude: number;
    longitude: number;
    address?: string;
  } | undefined>();
  const [locationError, setLocationError] = useState<string | null>(null);
  const [capturedImage, setCapturedImage] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [syncStatus, setSyncStatus] = useState<string>(""); // For displaying sync status
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  // Network status listeners
  useEffect(() => {
    const handleOnline = () => {
      console.log("🌐 ClockModal: Device is now ONLINE");
      setIsOnline(true);
      setSyncStatus("🌐 Online detected!");
    };
    
    const handleOffline = () => {
      console.log("🔴 ClockModal: Device is now OFFLINE");
      setIsOnline(false);
      setSyncStatus("🔴 Offline detected. Data will be stored locally.");
    };
    
    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);
    
    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, []);

  // Load face-api.js models on mount
  useEffect(() => {
    const loadModels = async () => {
      try {
        await faceapi.nets.tinyFaceDetector.loadFromUri("/models"); // Path to public/models
        console.log("face-api.js models loaded");
      } catch (err) {
        console.error("Error loading face-api.js models:", err);
      }
    };
    loadModels();
  }, []);

  const handleLocationClick = async () => {
    if (!shareLocation) {
      try {
        const position = await getCurrentPosition();
        const { latitude, longitude } = position.coords;
        
        // Only attempt reverse geocoding if online
        let address: string | undefined;
        if (navigator.onLine) {
          address = await reverseGeocode(latitude, longitude);
        }
        
        setLocation({
          latitude,
          longitude,
          address
        });
        setShareLocation(true);
        setLocationError(null);
      } catch (error) {
        console.error("Error getting location:", error);
        setLocationError("Failed to get location. Please check permissions.");
        setShareLocation(false);
        setLocation(undefined);
      }
    } else {
      setLocation(undefined);
      setShareLocation(false);
    }
  };

  const getCurrentPosition = (): Promise<GeolocationPosition> => {
    return new Promise((resolve, reject) => {
      if (!navigator.geolocation) {
        reject(new Error("Geolocation is not supported by your browser"));
      }
      
      navigator.geolocation.getCurrentPosition(
        resolve,
        (error) => reject(error),
        { 
          enableHighAccuracy: true,
          timeout: 10000,
          maximumAge: 0
        }
      );
    });
  };

  const reverseGeocode = async (lat: number, lng: number) => {
    try {
      const apiKey = await getOpenCageKey(); // Get from Realtime DB
      
      const response = await fetch(
        `https://api.opencagedata.com/geocode/v1/json?q=${lat}+${lng}&key=${apiKey}`
      );
      
      const data = await response.json();
      return data.results[0]?.formatted || "Unknown location";
    } catch (error) {
      console.error("Geocoding failed:", error);
      return "Location lookup failed";
    }
  };

  const takePhoto = () => {
    const canvas = canvasRef.current;
    const video = videoRef.current;
    if (canvas && video) {
      const ctx = canvas.getContext("2d");
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      ctx?.drawImage(video, 0, 0, canvas.width, canvas.height);
      const image = canvas.toDataURL("image/png");
      setCapturedImage(image);
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((track) => track.stop());
        streamRef.current = null;
      }
    }
  };

  const handleRetake = () => {
    setCapturedImage(null);
    navigator.mediaDevices.getUserMedia({ video: true }).then((stream) => {
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.play();
      }
    });
  };

  const uploadToFirebase = async (imageDataUrl: string): Promise<string> => {
    try {
      const today = new Date();
      const dateFolder = today.toISOString().split("T")[0];
      const timestamp = today.getTime();
      const fileName = `time-ins/${dateFolder}/user_${timestamp}.png`;
      const storageRef = ref(imageDb, fileName);
      const base64Data = imageDataUrl.split(",")[1];
      await uploadString(storageRef, base64Data, "base64");
      const downloadUrl = await getDownloadURL(storageRef);
      console.log("Image uploaded successfully to:", fileName);
      return downloadUrl;
    } catch (error) {
      console.error("Error uploading image:", error);
      throw error;
    }
  };

  // Detect face using face-api.js
  const detectFace = async (canvas: HTMLCanvasElement): Promise<boolean> => {
    try {
      const detections = await faceapi.detectAllFaces(canvas, new faceapi.TinyFaceDetectorOptions());
      console.log("Faces detected:", detections.length);
      return detections.length > 0;
    } catch (error) {
      console.error("Face detection error:", error);
      return false;
    }
  };

  // SIMPLIFIED handleSubmit - Let Dashboard handle offline logic
  const handleSubmit = async () => {
    if (!capturedImage || !canvasRef.current) {
      alert("Please take a photo before submitting.");
      return;
    }

    try {
      setIsUploading(true);
      setSyncStatus("Processing submission...");

      console.log("🎯 ClockModal: Starting submission process");
      console.log("🔍 ClockModal: Online status:", isOnline);

      // Validate face detection
      const hasFace = await detectFace(canvasRef.current);
      if (!hasFace) {
        alert("No face detected. Please retake the photo.");
        setIsUploading(false);
        setCapturedImage(null);
        setSyncStatus("");
        return;
      }

      // Create timestamp
      const now = new Date();
      const manilaTime = new Date(now.toLocaleString("en-US", { timeZone: "Asia/Manila" }));
      const formattedTimestamp = manilaTime.toLocaleTimeString("en-US", {
        hour: "2-digit",
        minute: "2-digit",
        hour12: true
      });

      console.log("📅 ClockModal: Created timestamp:", formattedTimestamp);

      // Prepare location data
      const locationData = shareLocation && location ? {
        latitude: location.latitude,
        longitude: location.longitude,
        address: location.address
      } : undefined;

      console.log("📍 ClockModal: Location data:", locationData);

      // Check if we're online for Firebase upload
      if (isOnline) {
        try {
          console.log("🌐 ClockModal: Online - attempting Firebase upload");
          setSyncStatus("Uploading image to Firebase...");
          
          const imageUrl = await uploadToFirebase(capturedImage);
          console.log("✅ ClockModal: Image uploaded to Firebase:", imageUrl);
          setSyncStatus("Image uploaded successfully!");
          
          // Call onSubmitClockLog with Firebase URL (Dashboard will save to Firestore)
          console.log("📤 ClockModal: Calling onSubmitClockLog with Firebase URL");
          onSubmitClockLog(
            capturedImage, 
            formattedTimestamp, 
            imageUrl, 
            locationData
          );
          
          setSyncStatus("Attendance recorded successfully!");
          console.log("✅ ClockModal: Submission completed successfully (online)");
          
        } catch (uploadError) {
          console.error("❌ ClockModal: Firebase upload failed:", uploadError);
          setSyncStatus("Firebase upload failed, saving offline...");
          
          // Firebase failed, let Dashboard handle offline save
          console.log("🔄 ClockModal: Calling onSubmitClockLog for offline save");
          onSubmitClockLog(
            capturedImage, 
            formattedTimestamp, 
            undefined, // No Firebase URL
            locationData
          );
          
          console.log("💾 ClockModal: Submitted for offline save");
        }
      } else {
        console.log("📱 ClockModal: Offline - calling onSubmitClockLog for offline save");
        setSyncStatus("Offline - saving locally...");
        
        // We're offline, let Dashboard handle offline save
        onSubmitClockLog(
          capturedImage, 
          formattedTimestamp, 
          undefined, // No Firebase URL when offline
          locationData
        );
        
        setSyncStatus("Saved locally - will sync when online!");
        console.log("💾 ClockModal: Submitted for offline save (offline mode)");
      }

      // Reset UI after successful submission
      setCapturedImage(null);
      handleCameraClick();

    } catch (error) {
      console.error("❌ ClockModal: Submit error:", error);
      setSyncStatus(`Error: ${error}`);
      alert("Failed to process attendance. Please try again.");
    } finally {
      setIsUploading(false);
      // Clear status after a delay
      setTimeout(() => setSyncStatus(""), 3000);
    }
  };

  useEffect(() => {
    if (showCamera && videoRef.current) {
      navigator.mediaDevices.getUserMedia({ video: true }).then((stream) => {
        streamRef.current = stream;
        videoRef.current!.srcObject = stream;
        videoRef.current!.play();
      });
    }
    return () => {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((track) => track.stop());
        streamRef.current = null;
      }
    };
  }, [showCamera]);

  return (
    <div className={showCamera ? styles.ClockModal : styles.ClockModal2}>
      <div className={styles.ClockModal_inner}>
        <div className={styles.Head}>
          <img onClick={handleCameraClick} className={styles.Close} src={Close} alt="Close" />
          <div className={styles.Head_inner}>
            <img src={Calendar} alt="Calendar Icon" />
            <span>{new Date().toLocaleString()}</span>
          </div>
        </div>

        <div className={styles.CameraContainer}>
          {capturedImage ? (
            <img src={capturedImage} className={styles.User} alt="Captured" />
          ) : (
            <video 
              ref={videoRef} 
              className={styles.User} 
              style={{ 
                maxHeight: "40vh",
                objectFit: "contain",
                margin: "0 auto"
              }} 
              autoPlay 
              muted 
              playsInline 
            />
          )}
          <canvas ref={canvasRef} style={{ display: "none" }} />
        </div>

        {shareLocation && location && (
          <div className={styles.LocationInfo}>
            <h4>Location Information:</h4>
            <p>Coordinates: {location.latitude.toFixed(4)}, {location.longitude.toFixed(4)}</p>
            {location.address && <p>Address: {location.address}</p>}
          </div>
        )}

        {locationError && (
          <div className={styles.LocationError}>
            <p>{locationError}</p>
          </div>
        )}

        {!isOnline && (
          <div className={styles.OfflineWarning}>
            <p>📱 You are offline. Your attendance will be saved locally and synced when you're back online.</p>
          </div>
        )}

        {syncStatus && (
          <div className={styles.SyncStatus} style={{
            padding: '8px',
            margin: '8px 0',
            backgroundColor: '#f8f9fa',
            border: '1px solid #dee2e6',
            borderRadius: '4px',
            fontSize: '14px',
            textAlign: 'center'
          }}>
            {syncStatus}
          </div>
        )}

        <div className={styles.Button}>
          <div className={styles.Button_inner}>
            <button
              className={shareLocation ? styles.Location : styles.Location2}
              onClick={handleLocationClick}
              disabled={isUploading}
            >
              {shareLocation ? "Location On" : "Location Off"}
            </button>
            <button onClick={capturedImage ? handleRetake : takePhoto} disabled={isUploading}>
              {capturedImage ? "Retake Photo" : "Take Photo"}
            </button>
          </div>
          <button
            className={shareLocation ? styles.Submit : styles.Submit2}
            onClick={handleSubmit}
            disabled={isUploading}
          >
            {isUploading ? "Processing..." : "Submit"}
          </button>
        </div>
      </div>
    </div>
  );
};

export default ClockModal;