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

// IndexedDB setup
const DB_NAME = "attendanceDB";
const DB_VERSION = 1;
const STORE_NAME = "pendingAttendance";

interface PendingAttendance {
  id?: number;
  image: string;
  timestamp: string;
  metadata: {
    date: string;
    time: string;
    timestampMs: number;
    formattedTime: string;
    withLocation: boolean;
    location?: {
      latitude: number;
      longitude: number;
    };
  };
  uploaded: boolean;
  createdAt: number;
}

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
  const [pendingUploads, setPendingUploads] = useState<number>(0);
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  // Initialize IndexedDB
  useEffect(() => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    
    request.onerror = (event) => {
      console.error("IndexedDB error:", event.target.error);
    };
    
    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;
      
      // Create object store for pending attendance records
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        const store = db.createObjectStore(STORE_NAME, { 
          keyPath: "id", 
          autoIncrement: true 
        });
        
        // Create indexes for easier querying
        store.createIndex("uploaded", "uploaded", { unique: false });
        store.createIndex("createdAt", "createdAt", { unique: false });
      }
    };
    
    request.onsuccess = () => {
      console.log("IndexedDB initialized successfully");
      // Check for pending uploads on initialization
      checkPendingUploads();
    };
  }, []);

  // Network status listeners
  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      console.log("App is online. Checking for pending uploads...");
      syncPendingAttendance();
    };
    
    const handleOffline = () => {
      setIsOnline(false);
      console.log("App is offline. Data will be stored locally.");
    };
    
    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);
    
    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, []);

  // Check for pending uploads
  const checkPendingUploads = () => {
    const request = indexedDB.open(DB_NAME);
    
    request.onsuccess = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;
      const transaction = db.transaction([STORE_NAME], "readonly");
      const store = transaction.objectStore(STORE_NAME);
      const index = store.index("uploaded");
      
      const countRequest = index.count(IDBKeyRange.only(false));
      
      countRequest.onsuccess = () => {
        setPendingUploads(countRequest.result);
      };
      
      transaction.oncomplete = () => {
        db.close();
      };
    };
  };

  // Save attendance to IndexedDB
  const saveToIndexedDB = (attendanceData: PendingAttendance) => {
    return new Promise<void>((resolve, reject) => {
      const request = indexedDB.open(DB_NAME);
      
      request.onerror = (event) => {
        reject((event.target as IDBOpenDBRequest).error);
      };
      
      request.onsuccess = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;
        const transaction = db.transaction([STORE_NAME], "readwrite");
        const store = transaction.objectStore(STORE_NAME);
        
        const addRequest = store.add(attendanceData);
        
        addRequest.onsuccess = () => {
          console.log("Attendance data saved to IndexedDB:", addRequest.result);
          checkPendingUploads();
          resolve();
        };
        
        addRequest.onerror = (event) => {
          reject((event.target as IDBRequest).error);
        };
        
        transaction.oncomplete = () => {
          db.close();
        };
      };
    });
  };

  // Sync pending attendance records with server
  const syncPendingAttendance = async () => {
    if (!navigator.onLine) {
      console.log("Still offline. Can't sync data yet.");
      return;
    }
    
    console.log("Syncing pending attendance records...");
    
    const request = indexedDB.open(DB_NAME);
    
    request.onsuccess = async (event) => {
      const db = (event.target as IDBOpenDBRequest).result;
      const transaction = db.transaction([STORE_NAME], "readwrite");
      const store = transaction.objectStore(STORE_NAME);
      const index = store.index("uploaded");
      
      const pendingRecords = await new Promise<PendingAttendance[]>((resolve) => {
        const request = index.openCursor(IDBKeyRange.only(false));
        const records: PendingAttendance[] = [];
        
        request.onsuccess = (event) => {
          const cursor = (event.target as IDBRequest).result as IDBCursorWithValue;
          
          if (cursor) {
            records.push(cursor.value);
            cursor.continue();
          } else {
            resolve(records);
          }
        };
      });
      
      console.log(`Found ${pendingRecords.length} pending records to sync`);
      
      for (const record of pendingRecords) {
        try {
          // Get address using reverse geocoding if location exists
          let address: string | undefined;
          if (record.metadata.withLocation && record.metadata.location) {
            try {
              address = await reverseGeocode(
                record.metadata.location.latitude,
                record.metadata.location.longitude
              );
            } catch (error) {
              console.warn("Failed to reverse geocode:", error);
            }
          }
          
          // Upload image to Firebase
          const imageUrl = await uploadToFirebase(record.image);
          
          // Prepare location object
          const locationData = record.metadata.withLocation && record.metadata.location
            ? {
                latitude: record.metadata.location.latitude,
                longitude: record.metadata.location.longitude,
                address: address
              }
            : undefined;
          
          // Submit to main system
          onSubmitClockLog(
            record.image,
            record.timestamp,
            imageUrl,
            locationData
          );
          
          // Mark as uploaded in IndexedDB
          const updateRequest = store.put({
            ...record,
            uploaded: true
          });
          
          await new Promise<void>((resolve, reject) => {
            updateRequest.onsuccess = () => resolve();
            updateRequest.onerror = () => reject(updateRequest.error);
          });
          
          console.log(`Successfully synced record ID: ${record.id}`);
        } catch (error) {
          console.error(`Failed to sync record ID: ${record.id}`, error);
        }
      }
      
      transaction.oncomplete = () => {
        db.close();
        checkPendingUploads();
      };
    };
  };

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

  const handleSubmit = async () => {
    if (!capturedImage || !canvasRef.current) {
      alert("Please take a photo before submitting.");
      return;
    }

    try {
      setIsUploading(true);

      const hasFace = await detectFace(canvasRef.current);
      if (!hasFace) {
        alert("No face detected. Please retake the photo.");
        setIsUploading(false);
        setCapturedImage(null);
        return;
      }

      const now = new Date();
      const formattedTimestamp = now.toLocaleString("en-US", {
        weekday: "long",
        month: "short",
        day: "2-digit",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
        hour12: true,
      });

      // Create attendance record
      const attendanceData: PendingAttendance = {
        image: capturedImage,
        timestamp: formattedTimestamp,
        metadata: {
          date: now.toISOString().split("T")[0],
          time: now.toTimeString().split(" ")[0],
          timestampMs: now.getTime(),
          formattedTime: formattedTimestamp,
          withLocation: shareLocation,
          location: shareLocation && location ? {
            latitude: location.latitude,
            longitude: location.longitude
          } : undefined
        },
        uploaded: false,
        createdAt: Date.now()
      };

      if (navigator.onLine) {
        // Process online - upload immediately
        const imageUrl = await uploadToFirebase(capturedImage);
        
        onSubmitClockLog(
          capturedImage, 
          formattedTimestamp, 
          imageUrl, 
          shareLocation ? location : undefined
        );
        
        console.log("Time-in recorded and uploaded successfully");
      } else {
        // Process offline - save to IndexedDB
        await saveToIndexedDB(attendanceData);
        console.log("Time-in saved locally. Will upload when online.");
        
        // Show notification to user
        alert("You are currently offline. Your attendance has been saved and will be uploaded when you're back online.");
      }

      setCapturedImage(null);
      handleCameraClick();
    } catch (error) {
      alert("Failed to process attendance. Please try again.");
      console.error("Submit error:", error);
    } finally {
      setIsUploading(false);
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

        {capturedImage ? (
          <img src={capturedImage} className={styles.User} alt="Captured" />
        ) : (
          <video ref={videoRef} className={styles.User} autoPlay muted playsInline />
        )}
        <canvas ref={canvasRef} style={{ display: "none" }} />

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
            <p>You are currently offline. Your attendance will be saved locally and uploaded when you're back online.</p>
          </div>
        )}

        {pendingUploads > 0 && (
          <div className={styles.PendingUploads}>
            <p>{pendingUploads} pending upload{pendingUploads !== 1 ? 's' : ''}</p>
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
            {isUploading ? "Uploading..." : "Submit"}
          </button>
        </div>
      </div>
    </div>
  );
};

export default ClockModal;