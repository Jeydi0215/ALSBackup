import { useState } from "react";

import styles from "../css/EmployeeLocation.module.css";
import Dowelle from "../assets/Dowelle.avif";

const EmployeeLocation = () => {
  const [randomButton, setRandomButton] = useState(false);
  const handleRandomCbutton = () => {
    setRandomButton(!randomButton);
  };
  return (
    <div className={styles.EmployeeLocation}>
      <span className={styles.Location_title}>Employee Location</span>
      <button onClick={handleRandomCbutton} className={styles.Random}>
        Random In
      </button>
      <div className={styles.Location_container}>
        <div className={styles.SpecificLocation}>
          <div className={styles.Location_inner}>
            <img src={Dowelle} />
            <span>Dowelle Dayle Mon</span>
          </div>
          <span>10:38AM</span>
        </div>

        <div className={styles.SpecificLocation}>
          <div className={styles.Location_inner}>
            <img src={Dowelle} />
            <span>Dowelle Dayle Mon</span>
          </div>
          <span>10:38AM</span>
        </div>
      </div>

      {randomButton && (
        <div className={styles.Add_holiday}>
          Are you sure you want to call for random location sharing?
          <div className={styles.Add_button}>
            <button onClick={handleRandomCbutton}>Cancel</button>
            <button onClick={handleRandomCbutton}>Submit</button>
          </div>
        </div>
      )}
    </div>
  );
};

export default EmployeeLocation;
