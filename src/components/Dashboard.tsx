import { useState, useEffect } from "react";
import styles from "../css/Dashboard.module.css";
import Pause from "../assets/pause.png";
import Resume from "../assets/resume.png";
import Camera from "../assets/camera.png";
import Eye from "../assets/eye.png";
import Filter from "../assets/sort.png";

<<<<<<< Updated upstream
type Props = {
  handleCameraClick: () => void;
  showCamera: () => void;
};
const Dashboard = ({ handleCameraClick, showCamera }: Props) => {
=======
const Dashboard = ({ handleCameraClick, clockLog }) => {
>>>>>>> Stashed changes
  const [isResume, setIsResume] = useState(false);
  const [time, setTime] = useState("");
  const [timestamps, setTimestamps] = useState({
    clockIn: "",
    breakIn: "",
    breakOut: "",
    clockOut: ""
  });
  
  // Store the latest log for each action type
  const [actionLogs, setActionLogs] = useState({
    clockIn: null,
    breakIn: null,
    breakOut: null,
    clockOut: null
  });

  const handleResume = () => setIsResume(!isResume);

  useEffect(() => {
    const updateClock = () => {
      const now = new Date();
      const options = {
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
        hour12: true,
<<<<<<< Updated upstream
        timeZone: "Asia/Manila", // PST
=======
        timeZone: "Asia/Manila",
>>>>>>> Stashed changes
      };
      const timeString = now.toLocaleTimeString("en-US", options);
      setTime(timeString + " PHT");
    };

    updateClock();
    const interval = setInterval(updateClock, 1000);
    return () => clearInterval(interval);
  }, []);

<<<<<<< Updated upstream
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
=======
  // Calculate working hours between clock in and clock out
  const calculateWorkingHours = (clockInTime, breakInTime, breakOutTime, clockOutTime) => {
    // Return empty string if no clock in or clock out
    if (!clockInTime || !clockOutTime) return "";
    
    // Parse the time strings
    const parseTimeString = (timeStr) => {
      const [time, period] = timeStr.split(" ");
      let [hours, minutes] = time.split(":");
      hours = parseInt(hours);
      
      // Convert to 24-hour format
      if (period === "PM" && hours < 12) {
        hours += 12;
      } else if (period === "AM" && hours === 12) {
        hours = 0;
      }
      
      return { hours, minutes: parseInt(minutes) };
    };
    
    // Calculate total minutes
    const clockIn = parseTimeString(clockInTime);
    const clockOut = parseTimeString(clockOutTime);
    
    let totalMinutes = (clockOut.hours - clockIn.hours) * 60 + (clockOut.minutes - clockIn.minutes);
    
    // Subtract break time if available
    if (breakInTime && breakOutTime) {
      const breakIn = parseTimeString(breakInTime);
      const breakOut = parseTimeString(breakOutTime);
      
      const breakMinutes = (breakOut.hours - breakIn.hours) * 60 + (breakOut.minutes - breakIn.minutes);
      totalMinutes -= breakMinutes;
    }
    
    // Handle negative time (e.g., if clock out is before clock in)
    if (totalMinutes < 0) return "";
    
    // Convert back to hours and minutes
    const hours = Math.floor(totalMinutes / 60);
    const minutes = totalMinutes % 60;
    
    // Format as string
    return `${hours}h ${minutes}m`;
  };

  // Camera button click handler
  const handleCameraButtonClick = (e, key) => {
    // Prevent any default browser behavior that might cause form submission
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }
    
    const now = new Date();
    const timeString = now.toLocaleTimeString("en-US", {
      hour: "2-digit",
      minute: "2-digit",
      hour12: true,
      timeZone: "Asia/Manila"
    });
    
    // Update the timestamps display
    setTimestamps(prev => ({ ...prev, [key]: timeString }));
    
    // Store this information for the weekly report
    setActionLogs(prev => ({
      ...prev,
      [key]: {
        time: now,
        timeString: timeString,
        key: key
      }
    }));
    
    // Call the parent component's handler with the key
    if (typeof handleCameraClick === 'function') {
      handleCameraClick(key);
    }
    
    // Return false to prevent any potential form submission
    return false;
  };
  
  // Group logs by date for the weekly report
  const getWeeklyReportData = () => {
    // Get dates from the clock log
    const dates = {};
    
    if (clockLog && clockLog.length > 0) {
      clockLog.forEach(log => {
        if (!log.time) return;
        
        const logDate = new Date(log.time);
        if (isNaN(logDate.getTime())) return;
        
        const dateStr = logDate.toLocaleDateString("en-US", {
          month: "long",
          day: "2-digit",
          year: "numeric"
        });
        
        if (!dates[dateStr]) {
          const today = new Date().toLocaleDateString("en-US", {
            month: "long",
            day: "2-digit",
            year: "numeric"
          });
          
          // If it's today, use the current timestamps
          const isToday = dateStr === today;
          
          dates[dateStr] = {
            date: dateStr,
            image: null,
            // Initialize with the current state values for today or empty for other days
            clockIn: isToday ? actionLogs.clockIn?.timeString || "" : "",
            breakIn: isToday ? actionLogs.breakIn?.timeString || "" : "",
            breakOut: isToday ? actionLogs.breakOut?.timeString || "" : "",
            clockOut: isToday ? actionLogs.clockOut?.timeString || "" : "",
            workingHours: ""
          };
        }
        
        // Add the image
        if (log.image) {
          dates[dateStr].image = log.image;
        }
      });
    }
    
    // Calculate working hours for each date
    Object.values(dates).forEach(day => {
      day.workingHours = calculateWorkingHours(
        day.clockIn, 
        day.breakIn, 
        day.breakOut, 
        day.clockOut
      );
    });
    
    // Convert to array and sort
    return Object.values(dates).sort((a, b) => {
      return new Date(b.date) - new Date(a.date);
    });
  };
  
  const weeklyReportData = getWeeklyReportData();

>>>>>>> Stashed changes
  return (
    <div className={styles.Dashboard}>
      <h1 className={styles.Dash_title}>Dashboard</h1>

      <div className={styles.Dashboard_widgets}>
        <div className={styles.Widget_top}>
          <div className={styles.Widget_left}>
            <div className={styles.Date}>
<<<<<<< Updated upstream
              <span>{weekday}</span>
              <span>{dayNumber}</span>
=======
              <span>{new Date().toLocaleDateString("en-US", { weekday: "long" })}</span>
              <span>{new Date().getDate()}</span>
>>>>>>> Stashed changes
            </div>
            <span className={styles.Name}>John Neo Lopez</span>
          </div>

          <div className={styles.Widget_right}>
            <div className={styles.Pause_con}>
              {isResume ? (
                <div className={styles.Pause} onClick={handleResume}>
                  <span>Pause</span>
                  <img src={Resume} alt="Resume Icon" />
                </div>
              ) : (
                <div className={styles.Resume} onClick={handleResume}>
                  <span>Resume</span>
                  <img src={Pause} alt="Pause Icon" />
                </div>
              )}
            </div>
            <span className={styles.Time}>{time}</span>
          </div>
        </div>

        <div className={styles.Widget_bottom}>
          {[
            { label: "Clock In", key: "clockIn" },
            { label: "Break In", key: "breakIn" },
            { label: "Break Out", key: "breakOut" },
            { label: "Clock Out", key: "clockOut" }
          ].map(({ label, key }, idx) => (
            <div className={styles.Clockin1} key={key}>
              <div className={styles.Clock_widget}>
                <div className={styles.Clock_inner}>
                  <span>{label}</span>
                  <img className={styles.Eye} src={Eye} alt="eye" />
                </div>
                <span className={styles.Time_widget}>{timestamps[key]}</span>
              </div>
              {/* Camera button with explicit event prevention */}
              <img
                className={styles.Camera}
                src={Camera}
                alt="camera"
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  handleCameraButtonClick(e, key);
                  return false; // This helps prevent any form submission
                }}
                onMouseDown={(e) => e.preventDefault()} // Prevent mousedown default actions
                style={{
                  opacity:
                    (key === "clockIn") ||
                    (key === "breakIn" && timestamps.clockIn) ||
                    (key === "breakOut" && timestamps.breakIn) ||
                    (key === "clockOut" && timestamps.breakOut)
                      ? 1
                      : 0.5,
                  pointerEvents:
                    (key === "clockIn") ||
                    (key === "breakIn" && timestamps.clockIn) ||
                    (key === "breakOut" && timestamps.breakIn) ||
                    (key === "clockOut" && timestamps.breakOut)
                      ? "auto"
                      : "none"
                }}
              />
            </div>
          ))}
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

        {clockLog && clockLog.length > 0 ? (
          <div className={styles.WeeklyTable}>
            <table>
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Clock In</th>
                  <th>Break In</th>
                  <th>Break Out</th>
                  <th>Clock Out</th>
                  <th>Working Hours</th>
                  <th>Status (Photo)</th>
                </tr>
              </thead>
              <tbody>
                {weeklyReportData.map((day, index) => (
                  <tr key={index}>
                    <td>{day.date}</td>
                    <td>{day.clockIn}</td>
                    <td>{day.breakIn}</td>
                    <td>{day.breakOut}</td>
                    <td>{day.clockOut}</td>
                    <td>{day.workingHours}</td>
                    <td>
                      {day.image && (
                        <img
                          src={day.image}
                          alt={`log-${index}`}
                          style={{
                            width: "60px",
                            height: "60px",
                            borderRadius: "8px",
                            objectFit: "cover",
                          }}
                        />
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p style={{ padding: "1rem", color: "#888" }}>
            No clock-in records yet. Use the camera button to add one.
          </p>
        )}
      </div>
    </div>
  );
};

export default Dashboard;