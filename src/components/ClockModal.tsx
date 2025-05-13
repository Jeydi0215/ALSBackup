import { useState, useRef, useEffect } from "react";

import styles from "../css/ClockModal.module.css";


import Calendar from "../assets/calendar.png";
import Close from "../assets/close.png";
// Import Firebase storage functions
import { ref, uploadString, getDownloadURL } from "firebase/storage";
import { imageDb } from "../firebase"; 

type Props = {
  handleCameraClick: () => void;
  showCamera: boolean;
  onSubmitClockLog: (image: string, timestamp: string, imageUrl?: string) => void;
};

const ClockModal = ({ handleCameraClick, showCamera, onSubmitClockLog }: Props) => {
  const [shareLocation, setShareLocation] = useState(false);
  const [capturedImage, setCapturedImage] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const handleLocationClick = () => setShareLocation(!shareLocation);

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
    setIsUploading(true);
    try {
      // Get current date in YYYY-MM-DD format for folder organization
      const today = new Date();
      const dateFolder = today.toISOString().split('T')[0]; // Format: YYYY-MM-DD
      
      // Create a unique filename for the image
      const timestamp = today.getTime();
      const fileName = `time-ins/${dateFolder}/user_${timestamp}.png`;
      
      // Create a reference to the file location in Firebase Storage
      const storageRef = ref(imageDb, fileName);
      
      // Extract the base64 data (remove the data URL prefix)
      const base64Data = imageDataUrl.split(',')[1];
      
      // Upload the image to Firebase Storage
      await uploadString(storageRef, base64Data, 'base64');
      
      // Get the download URL for the uploaded image
      const downloadUrl = await getDownloadURL(storageRef);
      
      console.log("Image uploaded successfully to:", fileName);
      return downloadUrl;
    } catch (error) {
      console.error("Error uploading image:", error);
      throw error;
    } finally {
      setIsUploading(false);
    }
  };

  const handleSubmit = async () => {
    if (capturedImage) {
      try {
        setIsUploading(true);
        
        // Create a Date object for consistent timestamps
        const now = new Date();
        
        // Format for display
        const formattedTimestamp = now.toLocaleString("en-US", {
          weekday: "long",
          month: "short",
          day: "2-digit",
          year: "numeric",
          hour: "2-digit",
          minute: "2-digit",
          hour12: true,
        });
        
        // Upload the image to Firebase
        const imageUrl = await uploadToFirebase(capturedImage);
        
        // Create metadata object with additional time information
        const metadata = {
          date: now.toISOString().split('T')[0], // YYYY-MM-DD
          time: now.toTimeString().split(' ')[0], // HH:MM:SS
          timestamp: now.getTime(),
          formattedTime: formattedTimestamp,
          withLocation: shareLocation
        };
        
        // Pass the local image, timestamp, and the Firebase URL to the parent component
        onSubmitClockLog(capturedImage, formattedTimestamp, imageUrl);
        
        setCapturedImage(null);
        handleCameraClick();
        
        console.log("Time-in recorded successfully:", metadata);
      } catch (error) {
        alert("Failed to upload image. Please try again.");
        console.error("Upload error:", error);
      } finally {
        setIsUploading(false);
      }
    } else {
      alert("Please take a photo before submitting.");
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