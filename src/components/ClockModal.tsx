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

// Add a debug helper to expose key functionality
const DEBUG = true; // Set to true to enable debug features

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
  const [syncStatus, setSyncStatus] = useState<string>(""); // For displaying sync status
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  // Initialize IndexedDB
  useEffect(() => {
    const initializeDatabase = () => {
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
      
      request.onsuccess = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;
        console.log("IndexedDB initialized successfully");
        db.close();
        
        // Check for pending uploads on initialization
        checkPendingUploads();
        
        // If we're online when component mounts, try to sync immediately
        if (navigator.onLine) {
          setTimeout(() => {
            syncPendingAttendance();
          }, 1000);
        }
      };
    };
    
    initializeDatabase();
  }, []);

  // Improved network status listeners with better sync triggering
  useEffect(() => {
    // Define handlers
    const handleOnline = () => {
      console.log("🌐 NETWORK EVENT: Device is now ONLINE");
      setIsOnline(true);
      setSyncStatus("🌐 Online detected! Preparing to sync...");
      
      // Add a delay to ensure network is stable before syncing
      setTimeout(() => {
        console.log("Triggering sync after online event");
        syncPendingAttendance();
      }, 3000);
    };
    
    const handleOffline = () => {
      console.log("🔴 NETWORK EVENT: Device is now OFFLINE");
      setIsOnline(false);
      setSyncStatus("🔴 Offline detected. Data will be stored locally.");
    };
    
    // Set up event listeners
    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);
    
    // Check if we're online when component mounts and sync if needed
    if (navigator.onLine) {
      console.log("Component mounted while online. Scheduling initial sync check...");
      setSyncStatus("Performing initial sync check...");
      
      // Schedule an initial sync check with a delay
      setTimeout(() => {
        checkPendingUploads();
        // Only try to sync if there are pending uploads
        if (pendingUploads > 0) {
          console.log("Found pending uploads on mount, syncing...");
          syncPendingAttendance();
        } else {
          console.log("No pending uploads found on mount");
          setSyncStatus("No pending uploads found");
        }
      }, 3000);
    } else {
      console.log("Component mounted while offline");
      setSyncStatus("Started in offline mode");
    }
    
    // Set up periodic sync check (every 10 seconds)
    const intervalId = setInterval(() => {
      if (navigator.onLine && pendingUploads > 0) {
        console.log("Periodic sync check - attempting sync");
        setSyncStatus("Periodic sync check triggered");
        syncPendingAttendance();
      } else {
        console.log("Periodic sync check - conditions not met");
      }
    }, 10000); // Check every 10 seconds
    
    // Clean up
    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
      clearInterval(intervalId);
    };
  }, [pendingUploads]); // Add pendingUploads as dependency

  // Check for pending uploads - improved with better error handling
  const checkPendingUploads = () => {
    console.log("Checking for pending uploads...");
    
    try {
      const request = indexedDB.open(DB_NAME, DB_VERSION);
      
      request.onerror = (event) => {
        console.error("Error opening database to check uploads:", event.target.error);
      };
      
      request.onsuccess = (event) => {
        try {
          const db = (event.target as IDBOpenDBRequest).result;
          
          if (!db.objectStoreNames.contains(STORE_NAME)) {
            console.log("Store doesn't exist yet, no pending uploads");
            db.close();
            setPendingUploads(0);
            return;
          }
          
          const transaction = db.transaction([STORE_NAME], "readonly");
          const store = transaction.objectStore(STORE_NAME);
          
          if (!store.indexNames.contains("uploaded")) {
            console.log("'uploaded' index doesn't exist yet");
            db.close();
            setPendingUploads(0);
            return;
          }
          
          const index = store.index("uploaded");
          const countRequest = index.count(IDBKeyRange.only(false));
          
          countRequest.onsuccess = () => {
            const count = countRequest.result;
            console.log(`Found ${count} pending uploads`);
            setPendingUploads(count);
          };
          
          countRequest.onerror = (event) => {
            console.error("Error counting pending uploads:", event.target.error);
            setPendingUploads(0);
          };
          
          transaction.oncomplete = () => {
            db.close();
          };
        } catch (error) {
          console.error("Error in checkPendingUploads transaction:", error);
          setPendingUploads(0);
        }
      };
    } catch (error) {
      console.error("Error in checkPendingUploads:", error);
      setPendingUploads(0);
    }
  };

  // Improved save to IndexedDB with better error handling
  const saveToIndexedDB = async (attendanceData: PendingAttendance): Promise<void> => {
    console.log("Attempting to save to IndexedDB:", attendanceData);
    setSyncStatus("Opening IndexedDB...");

    return new Promise<void>((resolve, reject) => {
      try {
        // First ensure the database exists
        const openRequest = indexedDB.open(DB_NAME, DB_VERSION);
        
        openRequest.onerror = (event) => {
          console.error("Error opening database:", event.target.error);
          setSyncStatus(`Database error: ${event.target.error}`);
          reject(new Error(`Could not open IndexedDB: ${event.target.error}`));
        };
        
        openRequest.onupgradeneeded = (event) => {
          console.log("Database upgrade needed, creating store...");
          setSyncStatus("Creating database structure...");
          const db = (event.target as IDBOpenDBRequest).result;
          
          // Create object store if it doesn't exist
          if (!db.objectStoreNames.contains(STORE_NAME)) {
            const store = db.createObjectStore(STORE_NAME, { 
              keyPath: "id", 
              autoIncrement: true 
            });
            
            // Create indexes
            store.createIndex("uploaded", "uploaded", { unique: false });
            store.createIndex("createdAt", "createdAt", { unique: false });
            
            console.log("Store and indexes created successfully");
          }
        };
        
        openRequest.onsuccess = (event) => {
          try {
            const db = (event.target as IDBOpenDBRequest).result;
            setSyncStatus("Database opened successfully");
            console.log("Database opened successfully, creating transaction...");
            
            // Create transaction and get store
            const transaction = db.transaction([STORE_NAME], "readwrite");
            transaction.onerror = (txEvent) => {
              console.error("Transaction error:", txEvent.target.error);
              setSyncStatus(`Transaction error: ${txEvent.target.error}`);
              reject(new Error(`Transaction failed: ${txEvent.target.error}`));
            };
            
            const store = transaction.objectStore(STORE_NAME);
            
            // Add the record
            setSyncStatus("Adding attendance record to IndexedDB...");
            const addRequest = store.add(attendanceData);
            
            addRequest.onsuccess = (addEvent) => {
              const id = (addEvent.target as IDBRequest).result;
              console.log(`Attendance data saved with ID: ${id}`);
              setSyncStatus(`Record saved with ID: ${id}`);
              checkPendingUploads();
              resolve();
            };
            
            addRequest.onerror = (addEvent) => {
              console.error("Error adding record:", addEvent.target.error);
              setSyncStatus(`Error saving record: ${addEvent.target.error}`);
              reject(new Error(`Could not add record: ${addEvent.target.error}`));
            };
            
            transaction.oncomplete = () => {
              console.log("Transaction completed");
              setSyncStatus("Transaction completed");
              db.close();
            };
          } catch (innerError) {
            console.error("Error in database transaction:", innerError);
            setSyncStatus(`Database operation error: ${innerError}`);
            reject(new Error(`Error in database transaction: ${innerError}`));
          }
        };
      } catch (outerError) {
        console.error("Outer error in saveToIndexedDB:", outerError);
        setSyncStatus(`Critical error: ${outerError}`);
        reject(new Error(`Critical error in saveToIndexedDB: ${outerError}`));
      }
    });
  };

  // Sync pending attendance records with server - COMPLETELY REWRITTEN for reliability
  const syncPendingAttendance = async () => {
    if (!navigator.onLine) {
      setSyncStatus("Cannot sync: Device is offline");
      console.log("Cannot sync: Device is offline");
      return;
    }
    
    try {
      setSyncStatus("Starting sync process...");
      console.log("Starting sync process...");
      
      // Open database
      const db = await new Promise<IDBDatabase>((resolve, reject) => {
        const request = indexedDB.open(DB_NAME, DB_VERSION);
        request.onerror = (event) => reject((event.target as IDBOpenDBRequest).error);
        request.onsuccess = (event) => resolve((event.target as IDBOpenDBRequest).result);
      });
      
      // Get all pending records
      const pendingRecords = await new Promise<PendingAttendance[]>((resolve, reject) => {
        try {
          const transaction = db.transaction([STORE_NAME], "readonly");
          const store = transaction.objectStore(STORE_NAME);
          const index = store.index("uploaded");
          const records: PendingAttendance[] = [];
          
          const request = index.openCursor(IDBKeyRange.only(false));
          
          request.onsuccess = (event) => {
            const cursor = (event.target as IDBRequest).result as IDBCursorWithValue;
            if (cursor) {
              records.push(cursor.value);
              cursor.continue();
            } else {
              resolve(records);
            }
          };
          
          request.onerror = (event) => {
            reject((event.target as IDBRequest).error);
          };
          
          transaction.oncomplete = () => {
            // This is just to ensure transaction completes properly
          };
        } catch (error) {
          reject(error);
        }
      });
      
      setSyncStatus(`Found ${pendingRecords.length} pending records to sync`);
      console.log(`Found ${pendingRecords.length} pending records to sync`);
      
      if (pendingRecords.length === 0) {
        db.close();
        setSyncStatus("No pending records to sync");
        return;
      }
      
      // Process each record one by one
      for (const record of pendingRecords) {
        try {
          setSyncStatus(`Processing record ${record.id}...`);
          console.log(`Processing record ${record.id}...`);
          
          // 1. Upload image to Firebase first
          setSyncStatus(`Uploading image for record ${record.id}...`);
          const imageUrl = await uploadToFirebase(record.image);
          
          // 2. Get address if location is available and we're online
          let address: string | undefined;
          if (record.metadata.withLocation && record.metadata.location) {
            try {
              setSyncStatus(`Getting address for location...`);
              address = await reverseGeocode(
                record.metadata.location.latitude,
                record.metadata.location.longitude
              );
            } catch (error) {
              console.warn("Failed to get address:", error);
            }
          }
          
          // 3. Prepare location data
          const locationData = record.metadata.withLocation && record.metadata.location
            ? {
                latitude: record.metadata.location.latitude,
                longitude: record.metadata.location.longitude,
                address
              }
            : undefined;
          
          // 4. Call the onSubmitClockLog function to upload to database
          setSyncStatus(`Submitting record ${record.id} to database...`);
          onSubmitClockLog(
            record.image,
            record.timestamp,
            imageUrl,
            locationData
          );
          
          // 5. Mark as uploaded in IndexedDB
          await new Promise<void>((resolve, reject) => {
            try {
              const updateTransaction = db.transaction([STORE_NAME], "readwrite");
              const updateStore = updateTransaction.objectStore(STORE_NAME);
              
              const updateRequest = updateStore.put({
                ...record,
                uploaded: true
              });
              
              updateRequest.onsuccess = () => {
                console.log(`Record ${record.id} marked as uploaded`);
                resolve();
              };
              
              updateRequest.onerror = (event) => {
                reject((event.target as IDBRequest).error);
              };
              
              updateTransaction.oncomplete = () => {
                // Just to ensure transaction completes
              };
            } catch (error) {
              reject(error);
            }
          });
          
          setSyncStatus(`Successfully synced record ${record.id}`);
          console.log(`Successfully synced record ${record.id}`);
        } catch (error) {
          console.error(`Failed to sync record ${record.id}:`, error);
          setSyncStatus(`Error syncing record ${record.id}: ${error}`);
        }
      }
      
      // Update pending uploads count
      checkPendingUploads();
      db.close();
      setSyncStatus("Sync completed successfully");
      console.log("Sync completed successfully");
    } catch (error) {
      console.error("Error in sync process:", error);
      setSyncStatus(`Sync failed: ${error}`);
    }
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

  // Handle the submission with improved offline handling
  const handleSubmit = async () => {
    if (!capturedImage || !canvasRef.current) {
      alert("Please take a photo before submitting.");
      return;
    }

    try {
      setIsUploading(true);
      setSyncStatus("Processing submission...");

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

      // Check if we're online
      const currentlyOnline = navigator.onLine;
      console.log(`Network status when submitting: ${currentlyOnline ? "Online" : "Offline"}`);
      setSyncStatus(`Network status: ${currentlyOnline ? "Online" : "Offline"}`);

      if (currentlyOnline) {
        // We're online - try direct upload
        try {
          setSyncStatus("Uploading image to Firebase...");
          const imageUrl = await uploadToFirebase(capturedImage);
          setSyncStatus("Image uploaded successfully!");
          
          setSyncStatus("Submitting to database...");
          onSubmitClockLog(
            capturedImage, 
            formattedTimestamp, 
            imageUrl, 
            shareLocation ? location : undefined
          );
          
          setSyncStatus("Attendance recorded successfully!");
          console.log("Time-in recorded and uploaded successfully");
        } catch (error) {
          // Failed to upload despite being "online" - save locally instead
          console.error("Upload failed despite being online:", error);
          setSyncStatus(`Upload failed: ${error}. Saving locally instead...`);
          
          await saveToIndexedDB(attendanceData);
          alert("Upload failed. Your attendance has been saved locally and will be uploaded when possible.");
          console.log("Time-in saved locally due to upload failure.");
        }
      } else {
        // We're offline - save to IndexedDB
        setSyncStatus("Offline detected. Saving locally...");
        try {
          await saveToIndexedDB(attendanceData);
          setSyncStatus("Saved locally successfully!");
          console.log("Time-in saved locally. Will upload when online.");
          
          alert("You are currently offline. Your attendance has been saved and will be uploaded when you're back online.");
        } catch (dbError) {
          console.error("Failed to save locally:", dbError);
          setSyncStatus(`Failed to save locally: ${dbError}`);
          alert("Failed to save attendance locally. Please try again or check your connection.");
        }
      }

      // Reset UI after successful submission (either online or offline)
      setCapturedImage(null);
      handleCameraClick();
    } catch (error) {
      setSyncStatus(`Error: ${error}`);
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

        <div className={styles.CameraContainer}>
          {capturedImage ? (
            <img src={capturedImage} className={styles.User} alt="Captured" />
          ) : (
            <video 
              ref={videoRef} 
              className={styles.User} 
              style={{ 
                maxHeight: "40vh", // Limit height on mobile
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