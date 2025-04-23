import { useState, useRef, useEffect } from "react";

import styles from "../css/ClockModal.module.css";

import Picture from "../assets/picture.png";
import Calendar from "../assets/calendar.png";
import Close from "../assets/close.png";
import JK from "../assets/jk.jpg";

type Props = {
  handleCameraClick: () => void;
  showCamera: () => void;
};

const ClockModal = ({ handleCameraClick, showCamera }: Props) => {
  const [shareLocation, setShareLocation] = useState(false);
  const handleLocationClick = () => {
    setShareLocation(!shareLocation);
  };

  const [retakePhoto, setRetakePhoto] = useState(false);
  const handleRetakeClick = () => {
    setRetakePhoto(!retakePhoto);
  };

  return (
    <div className={showCamera ? styles.ClockModal : styles.ClockModal2}>
      <div className={styles.ClockModal_inner}>
        <div className={styles.Head}>
          <img
            onClick={handleCameraClick}
            className={styles.Close}
            src={Close}
            alt="User camera"
          />
          <div className={styles.Head_inner}>
            <img src={Calendar} alt="Calendar Icon" />
            <span>Tuesday, Apr 22, 2025, 11:33 AM</span>
          </div>
        </div>
        <img className={styles.User} src={JK} alt="User Picture" />
        <div className={styles.Button}>
          <div className={styles.Button_inner}>
            {shareLocation ? (
              <button className={styles.Location} onClick={handleLocationClick}>
                Location On
              </button>
            ) : (
              <button
                className={styles.Location2}
                onClick={handleLocationClick}
              >
                Location Off
              </button>
            )}
            {retakePhoto ? (
              <button onClick={handleRetakeClick}>Retake Photo</button>
            ) : (
              <button onClick={handleRetakeClick}>Take Photo</button>
            )}
          </div>
          <button className={shareLocation ? styles.Submit : styles.Submit2}>
            Submit
          </button>
        </div>
      </div>
    </div>
  );
};

export default ClockModal;
