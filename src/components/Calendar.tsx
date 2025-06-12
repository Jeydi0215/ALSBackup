import { useState } from "react";

import styles from "../css/Calendar.module.css";
import Trash from "../assets/trash.png";

const Calendar = () => {
  const [showAdd, setShowAdd] = useState(false);
  const handleShowClick = () => {
    setShowAdd(!showAdd);
  };
  return (
    <div className={styles.Calendar}>
      <span className={styles.Calendar_title}>Calendar</span>
      <div className={styles.Calendar_inner}>
        <div className={styles.Calendar_button}>
          <span>Custom Holidays</span>
          <div>
            <input type="date" />
            <button onClick={handleShowClick}>Add Holiday</button>
          </div>
        </div>

        <div className={styles.Holiday_con}>
          <div className={styles.Holiday}>
            <span>June 05, 2025</span>
            <img src={Trash} />
          </div>

          <div className={styles.Holiday}>
            <span>June 05, 2025</span>
            <img src={Trash} />
          </div>

          <div className={styles.Holiday}>
            <span>June 05, 2025</span>
            <img src={Trash} />
          </div>
        </div>
      </div>

      {/* modal dito kasi tinatamad na ko ihiwalay as component */}

      {showAdd && (
        <div className={styles.Add_holiday}>
          Are you sure you want to add June 05, 2025 as a custom Holiday?
          <div className={styles.Add_button}>
            <button onClick={handleShowClick}>Cancel</button>
            <button onClick={handleShowClick}>Submit</button>
          </div>
        </div>
      )}
    </div>
  );
};

export default Calendar;
