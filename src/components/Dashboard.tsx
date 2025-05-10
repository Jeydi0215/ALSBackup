import { useState, useEffect } from "react";
import styles from "../css/Dashboard.module.css";
import Pause from "../assets/pause.png";
import Resume from "../assets/resume.png";
import Camera from "../assets/camera.png";
import Eye from "../assets/eye.png";
import Filter from "../assets/sort.png";

type Props = {
  handleCameraClick: () => void;
  showCamera: () => void;
};
const Dashboard = ({ handleCameraClick, showCamera }: Props) => {
  const [isResume, setIsResume] = useState(false);
  const handleResume = () => {
    setIsResume(!isResume);
  };
  const [time, setTime] = useState<string>("");

  useEffect(() => {
    const updateClock = () => {
      const now = new Date();
      const options: Intl.DateTimeFormatOptions = {
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
        hour12: true,
        timeZone: "Asia/Manila", // PST
      };
      const timeString = now.toLocaleTimeString("en-US", options);
      setTime(timeString + " PHT");
    };

    updateClock(); // initialize right away
    const interval = setInterval(updateClock, 1000); // update every second

    return () => clearInterval(interval); // cleanup on unmount
  }, []);

  const [weekday, setWeekday] = useState<string>("");
  const [dayNumber, setDayNumber] = useState<string>("");

  useEffect(() => {
    const now = new Date();
  
    const weekdayOptions: Intl.DateTimeFormatOptions = {
      weekday: "long",
      timeZone: "Asia/Manila",
    };
  
    const dayOptions: Intl.DateTimeFormatOptions = {
      day: "numeric",
      timeZone: "Asia/Manila",
    };
  
    const weekdayString = now.toLocaleDateString("en-PH", weekdayOptions);
    const dayString = now.toLocaleDateString("en-PH", dayOptions);
  
    setWeekday(weekdayString);
    setDayNumber(dayString);
  }, []);
  return (
    <div className={styles.Dashboard}>
      <h1 className={styles.Dash_title}>Dashboard</h1>

      <div className={styles.Dashboard_widgets}>
        <div className={styles.Widget_top}>
          <div className={styles.Widget_left}>
            <div className={styles.Date}>
              <span>{weekday}</span>
              <span>{dayNumber}</span>
            </div>
            <span className={styles.Name}>John Neo Lopez</span>
          </div>

          <div className={styles.Widget_right}>
            <div className={styles.Pause_con}>
              {isResume ? (
                <div className={styles.Pause} onClick={handleResume}>
                  <span>Pause</span>
                  <img src={Resume} alt="" />
                </div>
              ) : (
                <div className={styles.Resume} onClick={handleResume}>
                  <span>Resume</span>
                  <img src={Pause} alt="" />
                </div>
              )}
              <div></div>
            </div>
            <span className={styles.Time}>{time}</span>
          </div>
        </div>

        <div className={styles.Widget_bottom}>
          <div className={styles.Clockin1}>
            <div className={styles.Clock_widget}>
              <div className={styles.Clock_inner}>
                <span>Clock In</span>
                <img className={styles.Eye} src={Eye} alt="Eye icon" />
              </div>
              <span className={styles.Time_widget}>8:00 AM</span>
            </div>
            <img
              onClick={handleCameraClick}
              className={styles.Camera}
              src={Camera}
              alt="Camera icon"
            />
          </div>

          <div className={styles.Clockin2}>
            <div className={styles.Clock_widget}>
              <div className={styles.Clock_inner}>
                <span>Clock In</span>
                <img className={styles.Eye} src={Eye} alt="Eye icon" />
              </div>
              <span className={styles.Time_widget}>8:00 AM</span>
            </div>
            <img className={styles.Camera} src={Camera} alt="Camera icon" />
          </div>

          <div className={styles.Clockin1}>
            <div className={styles.Clock_widget}>
              <div className={styles.Clock_inner}>
                <span>Clock In</span>
                <img className={styles.Eye} src={Eye} alt="Eye icon" />
              </div>
              <span className={styles.Time_widget}>8:00 AM</span>
            </div>
            <img className={styles.Camera} src={Camera} alt="Camera icon" />
          </div>

          <div className={styles.Clockin1}>
            <div className={styles.Clock_widget}>
              <div className={styles.Clock_inner}>
                <span>Clock In</span>
                <img className={styles.Eye} src={Eye} alt="Eye icon" />
              </div>
              <span className={styles.Time_widget}>8:00 AM</span>
            </div>
            <img className={styles.Camera} src={Camera} alt="Camera icon" />
          </div>
        </div>
      </div>

      <div className={styles.Weekly}>
        <div className={styles.Weekly_head}>
          <span className={styles.ReportText}>Weekly Report</span>
          <div className={styles.Filter}>
            <img src={Filter} alt="Filter icon" />
            <span>Filter by date</span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
