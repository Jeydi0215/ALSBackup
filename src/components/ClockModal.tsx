import { useState, useRef, useEffect } from "react";
import styles from "../css/ClockModal.module.css";
import Calendar from "../assets/calendar.png";
import Close from "../assets/close.png";
import { ref, uploadString, getDownloadURL } from "firebase/storage";
import { imageDb } from "../firebase";
import * as faceapi from "face-api.js";
import { getOpenCageKey } from '../utils/apiKeys';
import { savePendingLog, getPendingLogs, deletePendingLog } from '../utils/indexedDB';

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
  ) => Promise<void>;
};

const ClockModal = ({ handleCameraClick, showCamera, onSubmitClockLog }: Props) => {
  const [shareLocation, setShareLocation] = useState(false);
  const [location, setLocation] = useState<{
    latitude: number;
    longitude: number;
    address?: string;
  } | null>(null);
  const [locationError, setLocationError] = useState<string | null>(null);
  const [capturedImage, setCapturedImage] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [syncStatus, setSyncStatus] = useState("");
  const [showSuccessMessage, setShowSuccessMessage] = useState(false);
  const [successMessage, setSuccessMessage] = useState("");
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  // Network status
  useEffect(() => {
    const handleStatusChange = () => {
      setIsOnline(navigator.onLine);
      if (navigator.onLine) syncPendingLogs();
    };

    window.addEventListener('online', handleStatusChange);
    window.addEventListener('offline', handleStatusChange);
    return () => {
      window.removeEventListener('online', handleStatusChange);
      window.removeEventListener('offline', handleStatusChange);
    };
  }, []);

  // Face detection models
  useEffect(() => {
    const loadModels = async () => {
      try {
        await faceapi.nets.tinyFaceDetector.loadFromUri("/models");
      } catch (error) {
        console.error("Failed to load face models:", error);
      }
    };
    loadModels();
  }, []);

  // Camera setup
  useEffect(() => {
    if (!showCamera) return;

    const startCamera = async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: true });
        if (videoRef.current) {
          streamRef.current = stream;
          videoRef.current.srcObject = stream;
        }
      } catch (error) {
        console.error("Camera error:", error);
        alert("Camera access denied. Please enable camera permissions.");
      }
    };

    startCamera();
    return () => {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
      }
    };
  }, [showCamera]);

  // Show success message with auto-hide
  const showSuccess = (message: string) => {
    setSuccessMessage(message);
    setShowSuccessMessage(true);
    setTimeout(() => {
      setShowSuccessMessage(false);
      setSuccessMessage("");
    }, 4000); // Show for 4 seconds
  };

  // Sync localStorage fallback records
  const syncLocalStorageFallback = async () => {
    if (!isOnline) return;

    try {
      // Check for fallback records in localStorage
      const fallbackKeys = Object.keys(localStorage).filter(key => 
        key.startsWith('attendance_')
      );

      if (fallbackKeys.length > 0) {
        setSyncStatus(`Syncing ${fallbackKeys.length} fallback records...`);
        
        for (const key of fallbackKeys) {
          try {
            const logData = JSON.parse(localStorage.getItem(key) || '{}');
            const imageUrl = await uploadToFirebase(logData.image);
            await onSubmitClockLog(
              logData.image,
              logData.timestamp,
              imageUrl,
              logData.location
            );
            localStorage.removeItem(key);
          } catch (error) {
            console.error(`Failed to sync fallback record ${key}:`, error);
          }
        }
      }
    } catch (error) {
      console.error("Fallback sync error:", error);
    }
  };

  // IMPROVED sync pending logs using safer IndexedDB functions
  const syncPendingLogs = async () => {
    if (!isOnline) return;

    try {
      console.log("🔄 Starting ClockModal sync...");
      
      // Use the safer getPendingLogs function
      const pendingLogs = await getPendingLogs();
      
      // Also sync localStorage fallback records
      await syncLocalStorageFallback();
      
      if (pendingLogs.length === 0) {
        console.log("✅ No pending logs to sync in ClockModal");
        return;
      }

      setSyncStatus(`Syncing ${pendingLogs.length} pending attendance records...`);

      let successCount = 0;
      let errorCount = 0;
      const processedItems: any[] = [];

      for (const log of pendingLogs) {
        try {
          console.log("🔄 Syncing ClockModal log:", log.id);
          const imageUrl = await uploadToFirebase(log.image);
          await onSubmitClockLog(
            log.image,
            log.timestamp,
            imageUrl,
            log.location
          );
          processedItems.push(log);
          successCount++;
        } catch (error) {
          console.error("Failed to sync log:", error);
          errorCount++;
        }
      }

      // Remove successfully synced items using the safer delete function
      for (const item of processedItems) {
        try {
          await deletePendingLog(item.id);
          console.log(`🗑️ Deleted synced log: ${item.id}`);
        } catch (error) {
          console.error("Failed to delete synced log:", error);
        }
      }

      if (successCount > 0) {
        setSyncStatus(`Successfully synced ${successCount} records!`);
        showSuccess(`🎉 ${successCount} offline records have been synced!`);
        
        // Trigger sync event for Dashboard
        window.dispatchEvent(new CustomEvent('triggerOfflineSync'));
      }
      
      if (errorCount > 0) {
        setSyncStatus(`${errorCount} records failed to sync`);
      }

      console.log(`✅ ClockModal sync complete. Success: ${successCount}, Errors: ${errorCount}`);

    } catch (error) {
      console.error("❌ ClockModal sync error:", error);
      setSyncStatus("Failed to sync some records");
    } finally {
      setTimeout(() => setSyncStatus(""), 3000);
    }
  };

  const takePhoto = () => {
    const canvas = canvasRef.current;
    const video = videoRef.current;
    if (!canvas || !video) return;

    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext("2d");
    ctx?.drawImage(video, 0, 0, canvas.width, canvas.height);
    setCapturedImage(canvas.toDataURL("image/png"));
    
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
    }
  };

  const handleRetake = () => {
    setCapturedImage(null);
    navigator.mediaDevices.getUserMedia({ video: true })
      .then(stream => {
        streamRef.current = stream;
        if (videoRef.current) videoRef.current.srcObject = stream;
      })
      .catch(error => {
        console.error("Camera error:", error);
        alert("Failed to access camera. Please refresh the page.");
      });
  };

  const uploadToFirebase = async (imageData: string): Promise<string> => {
    const timestamp = Date.now();
    const dateFolder = new Date().toISOString().split("T")[0];
    const storageRef = ref(imageDb, `time-ins/${dateFolder}/user_${timestamp}.png`);
    const base64Data = imageData.split(",")[1];
    
    await uploadString(storageRef, base64Data, "base64");
    return await getDownloadURL(storageRef);
  };

  const detectFace = async (canvas: HTMLCanvasElement): Promise<boolean> => {
    try {
      const detections = await faceapi.detectAllFaces(
        canvas, 
        new faceapi.TinyFaceDetectorOptions()
      );
      return detections.length > 0;
    } catch (error) {
      console.error("Face detection error:", error);
      return false;
    }
  };

  const handleLocationClick = async () => {
    if (shareLocation) {
      setShareLocation(false);
      setLocation(null);
      setLocationError(null);
      return;
    }

    try {
      const position = await new Promise<GeolocationPosition>((resolve, reject) => {
        navigator.geolocation.getCurrentPosition(resolve, reject, {
          enableHighAccuracy: true,
          timeout: 10000,
          maximumAge: 300000 // Accept cached location up to 5 minutes old
        });
      });

      const { latitude, longitude } = position.coords;
      let address = "Location acquired";

      // Only try geocoding if online
      if (isOnline) {
        try {
          const apiKey = await getOpenCageKey();
          const response = await fetch(
            `https://api.opencagedata.com/geocode/v1/json?q=${latitude}+${longitude}&key=${apiKey}`,
            { 
              signal: AbortSignal.timeout(5000) // 5 second timeout
            }
          );
          
          if (response.ok) {
            const data = await response.json();
            address = data.results[0]?.formatted || address;
          }
        } catch (geocodingError) {
          console.warn("Geocoding failed, using coordinates only:", geocodingError);
          // Don't throw error, just use default address
        }
      } else {
        address = "Location acquired (offline)";
      }

      setLocation({ latitude, longitude, address });
      setShareLocation(true);
      setLocationError(null);
    } catch (error: any) {
      console.error("Location error:", error);
      let errorMessage = "Failed to get location.";
      
      if (error.code === 1) {
        errorMessage = "Location access denied. Please enable location permissions.";
      } else if (error.code === 2) {
        errorMessage = "Location unavailable. Please try again.";
      } else if (error.code === 3) {
        errorMessage = "Location request timed out. Please try again.";
      }
      
      setLocationError(errorMessage);
      setShareLocation(false);
    }
  };

  // IMPROVED handleSubmit function with safer IndexedDB usage
  const handleSubmit = async () => {
    if (!capturedImage || !canvasRef.current) {
      alert("Please take a photo before submitting.");
      return;
    }

    setIsUploading(true);
    setSyncStatus("Processing attendance...");

    try {
      // Face verification - skip if offline and models not loaded
      let hasFace = true; // Default to true for offline mode
      
      if (isOnline) {
        try {
          hasFace = await detectFace(canvasRef.current);
          if (!hasFace) {
            alert("No face detected. Please retake photo with clear face visibility.");
            setIsUploading(false);
            setCapturedImage(null);
            return;
          }
        } catch (faceDetectionError) {
          console.warn("Face detection failed, proceeding anyway:", faceDetectionError);
          // Continue with submission even if face detection fails
        }
      }

      // Prepare data
      const now = new Date();
      const manilaTime = new Date(now.toLocaleString("en-US", { timeZone: "Asia/Manila" }));
      const timestamp = manilaTime.toLocaleTimeString("en-US", {
        hour: "2-digit",
        minute: "2-digit",
        hour12: true
      });

      const logData = {
        image: capturedImage,
        timestamp,
        location: shareLocation ? location : null,
        createdAt: now.toISOString()
      };

      // Submission flow
      if (isOnline) {
        try {
          const imageUrl = await uploadToFirebase(capturedImage);
          await onSubmitClockLog(capturedImage, timestamp, imageUrl, shareLocation ? location : undefined);
          setSyncStatus("Attendance recorded successfully!");
          showSuccess("✅ Attendance recorded successfully!");
        } catch (onlineError) {
          console.error("Online submission failed, saving offline:", onlineError);
          try {
            // Use the safer savePendingLog function
            await savePendingLog(logData);
            setSyncStatus("Connection failed - saved offline, will sync when online");
            showSuccess("📱 Saved offline - will sync when online");
          } catch (dbError) {
            console.error("Failed to save to IndexedDB:", dbError);
            // Try localStorage as fallback
            try {
              const fallbackKey = `attendance_${Date.now()}`;
              localStorage.setItem(fallbackKey, JSON.stringify(logData));
              setSyncStatus("Saved locally - will sync when online");
              showSuccess("💾 Saved locally - will sync when online");
            } catch (storageError) {
              console.error("All storage methods failed:", storageError);
              throw new Error("Unable to save attendance record");
            }
          }
        }
      } else {
        // Offline mode - save using safer IndexedDB function
        try {
          await savePendingLog(logData);
          setSyncStatus("Saved offline - will sync when online");
          showSuccess("📱 Saved offline - will sync when online");
          console.log("Successfully saved offline attendance record");
        } catch (dbError) {
          console.error("IndexedDB save failed:", dbError);
          // Try localStorage as fallback
          try {
            const fallbackKey = `attendance_${Date.now()}`;
            localStorage.setItem(fallbackKey, JSON.stringify(logData));
            setSyncStatus("Saved locally - will sync when online");
            showSuccess("💾 Saved locally - will sync when online");
            console.log("Saved to localStorage as fallback");
          } catch (storageError) {
            console.error("All storage methods failed:", storageError);
            throw new Error("Unable to save attendance record");
          }
        }
      }

      // Reset on success
      setCapturedImage(null);
      handleCameraClick();
    } catch (error: any) {
      console.error("Submission error:", error);
      setSyncStatus("Failed to submit attendance");
      alert(`Submission failed: ${error.message || 'Please try again'}`);
    } finally {
      setIsUploading(false);
      setTimeout(() => setSyncStatus(""), 3000);
    }
  };

  return (
    <div className={showCamera ? styles.ClockModal : styles.ClockModal2}>
      <div className={styles.ClockModal_inner}>
        <div className={styles.Head}>
          <img 
            onClick={handleCameraClick} 
            className={styles.Close} 
            src={Close} 
            alt="Close" 
          />
          <div className={styles.Head_inner}>
            <img src={Calendar} alt="Calendar" />
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
              autoPlay
              muted
              playsInline
              style={{
                maxHeight: "40vh",
                objectFit: "contain",
                margin: "0 auto"
              }}
            />
          )}
          <canvas ref={canvasRef} style={{ display: "none" }} />
        </div>

        {shareLocation && location && (
          <div className={styles.LocationInfo}>
            <h4>Location:</h4>
            <p>Lat: {location.latitude.toFixed(4)}</p>
            <p>Lng: {location.longitude.toFixed(4)}</p>
            {location.address && <p>{location.address}</p>}
          </div>
        )}

        {locationError && (
          <div className={styles.LocationError}>
            <p>{locationError}</p>
          </div>
        )}

        {!isOnline && (
          <div className={styles.OfflineWarning}>
            <p>🔴 You are currently offline. Attendance will be saved locally.</p>
          </div>
        )}

        {syncStatus && (
          <div className={styles.SyncStatus}>
            <p>{syncStatus}</p>
          </div>
        )}

        {showSuccessMessage && (
          <div className={styles.SuccessMessage} style={{
            background: '#d4edda',
            border: '1px solid #c3e6cb',
            color: '#155724',
            padding: '10px',
            borderRadius: '4px',
            margin: '10px 0',
            animation: 'fadeIn 0.3s ease-in'
          }}>
            <p>{successMessage}</p>
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
            <button 
              onClick={capturedImage ? handleRetake : takePhoto}
              disabled={isUploading}
            >
              {capturedImage ? "Retake Photo" : "Take Photo"}
            </button>
          </div>
          <button
            className={shareLocation ? styles.Submit : styles.Submit2}
            onClick={handleSubmit}
            disabled={isUploading || !capturedImage}
          >
            {isUploading ? "Processing..." : "Submit"}
          </button>
        </div>
      </div>

      <style jsx>{`
        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(-10px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </div>
  );
};

export default ClockModal;