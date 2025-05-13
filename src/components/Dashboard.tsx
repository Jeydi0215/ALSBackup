import { useState, useEffect } from "react";
import styles from "../css/Dashboard.module.css";
// import Pause from "../assets/pause.png";
// import Resume from "../assets/resume.png";
import Camera from "../assets/camera.png";
import Eye from "../assets/eye.png";
import Filter from "../assets/sort.png";
import { useAuth } from "../context/AuthContext";
import {
  doc,
  getDoc,
  collection,
  query,
  where,
  orderBy,
  Timestamp,
  onSnapshot
} from "firebase/firestore";
import { db } from "../firebase";
import Papa from "papaparse";
import * as XLSX from "xlsx";



interface UserData {
  firstName: string;
  surname: string;
}

interface ClockLogEntry {
  imageUrl: string;
  id: string;
  uid: string;
  key: string;
  time?: Timestamp;
  timeString: string;
  date: string;
  image?: string;
}

interface DashboardProps {
  handleCameraClick: (key: string) => void; // Now accepts a key parameter
  showCamera: boolean;
}

const Dashboard: React.FC<DashboardProps> = ({ handleCameraClick }) => {
  const { currentUser } = useAuth();
  const [userData, setUserData] = useState<UserData | null>(null);
  const [clockLog, setClockLog] = useState<ClockLogEntry[]>([]);
  // const [isResume, setIsResume] = useState(false);
  const [time, setTime] = useState("");
  const [timestamps, setTimestamps] = useState({
    clockIn: "",
    breakIn: "",
    breakOut: "",
    clockOut: ""
  });

  const exportToExcel = () => {
    const weeklyData = getWeeklyReportData();

    const worksheetData = weeklyData.map((entry) => ({
      Date: entry.date,
      "Clock In": entry.clockIn,
      "Break In": entry.breakIn,
      "Break Out": entry.breakOut,
      "Clock Out": entry.clockOut,
      "Working Hours": entry.workingHours,
    }));

    const worksheet = XLSX.utils.json_to_sheet(worksheetData);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Weekly Report");

    XLSX.writeFile(workbook, "weekly-report.xlsx");
  };


  const exportToCSV = () => {
    const weeklyData = getWeeklyReportData();

    const csvData = weeklyData.map((entry) => ({
      Date: entry.date,
      "Clock In": entry.clockIn,
      "Break In": entry.breakIn,
      "Break Out": entry.breakOut,
      "Clock Out": entry.clockOut,
      "Working Hours": entry.workingHours,
    }));

    const csv = Papa.unparse(csvData);
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);

    const link = document.createElement("a");
    link.href = url;
    link.setAttribute("download", "weekly-report.csv");
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };


  // Fetch user data on component mount
  useEffect(() => {
    const fetchUserData = async () => {
      if (!currentUser) return;

      try {
        const userRef = doc(db, "users", currentUser.uid);
        const userSnap = await getDoc(userRef);

        if (userSnap.exists()) {
          setUserData(userSnap.data() as UserData);
        }
      } catch (error) {
        console.error("Error fetching user data:", error);
      }
    };

    fetchUserData();
  }, [currentUser]);

  // Fetch clock logs
  useEffect(() => {
    if (!currentUser) return;

    const q = query(
      collection(db, "clockLog"),
      where("uid", "==", currentUser.uid),
      orderBy("time", "desc")
    );

    const unsubscribe = onSnapshot(q, (querySnapshot) => {
      const logs = querySnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as ClockLogEntry[];
      setClockLog(logs);

      // Update timestamp widgets
      const latestEntries = logs.reduce((acc, log) => {
        if (log.key && !acc[log.key]) {
          acc[log.key] = log.timeString;
        }
        return acc;
      }, {} as Record<string, string>);

      setTimestamps(prev => ({ ...prev, ...latestEntries }));
    }, (error) => {
      console.error("Error listening for clock log changes:", error);
    });

    // Unsubscribe when component unmounts
    return () => unsubscribe();
  }, [currentUser]);

  // Update real-time clock
  useEffect(() => {
    const updateClock = () => {
      const now = new Date();
      const options = {
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
        hour12: true,
        timeZone: "Asia/Manila",
      };
      setTime(now.toLocaleTimeString("en-US", options) + " PHT");
    };

    updateClock();
    const interval = setInterval(updateClock, 1000);
    return () => clearInterval(interval);
  }, []);

  // const handleResume = () => setIsResume(!isResume);

  const calculateWorkingHours = (clockInTime: string, breakInTime: string, breakOutTime: string, clockOutTime: string) => {
    if (!clockInTime || !clockOutTime) return "";

    const parseTime = (timeStr: string) => {
      const [time, period] = timeStr.split(" ");
      let [hours, minutes] = time.split(":").map(Number);
      if (period === "PM" && hours < 12) hours += 12;
      if (period === "AM" && hours === 12) hours = 0;
      return hours * 60 + minutes;
    };

    const clockIn = parseTime(clockInTime);
    const clockOut = parseTime(clockOutTime);
    let totalMinutes = clockOut - clockIn;

    if (breakInTime && breakOutTime) {
      totalMinutes -= (parseTime(breakOutTime) - parseTime(breakInTime));
    }

    if (totalMinutes <= 0) return "0m";

    const hours = Math.floor(totalMinutes / 60);
    const minutes = totalMinutes % 60;
    return `${hours > 0 ? `${hours}h ` : ""}${minutes}m`;
  };

  const handleCameraButtonClick = async (e: React.MouseEvent, key: string) => {
    if (!isButtonEnabled(key)) {
      alert(`You have already submitted your "${key.replace(/([A-Z])/g, ' $1')}" today.`);
      return;
    }

    e.preventDefault();
    e.stopPropagation();
    handleCameraClick(key);
  };

  const getWeeklyReportData = () => {
    const now = new Date();
    const sevenDaysAgo = new Date(now);
    sevenDaysAgo.setDate(now.getDate() - 6); // Includes today + 6 previous days

    const dates: Record<string, any> = {};

    clockLog.forEach(log => {
      if (!log.time || !log.key || !log.timeString) return;

      const logDateObj = log.time instanceof Timestamp ? log.time.toDate() : new Date(log.time);
      const logDateStr = logDateObj.toLocaleDateString("en-US", {
        month: "long",
        day: "2-digit",
        year: "numeric",
      });

      // Only include logs from the last 7 days
      if (logDateObj < sevenDaysAgo || logDateObj > now) return;

      if (!dates[logDateStr]) {
        dates[logDateStr] = {
          date: logDateStr,
          image: null,
          clockIn: "",
          breakIn: "",
          breakOut: "",
          clockOut: "",
          workingHours: ""
        };
      }

      if (["clockIn", "breakIn", "breakOut", "clockOut"].includes(log.key) &&
        !dates[logDateStr][log.key]) {
        dates[logDateStr][log.key] = log.timeString;
        if (log.key === "clockIn" && log.imageUrl) {
          dates[logDateStr].image = log.imageUrl;
        }
      }
    });

    Object.values(dates).forEach((day: any) => {
      day.workingHours = calculateWorkingHours(
        day.clockIn,
        day.breakIn,
        day.breakOut,
        day.clockOut
      );
    });

    // Sort the grouped days from newest to oldest
    return Object.values(dates).sort((a: any, b: any) =>
      new Date(b.date).getTime() - new Date(a.date).getTime()
    );
  };

  const isButtonEnabled = (key: string): boolean => {
    const todayStr = new Date().toLocaleDateString("en-US", {
      month: "long",
      day: "2-digit",
      year: "numeric",
    });

    const todayLogs = clockLog.filter(log => log.date === todayStr);
    const hasBreakIn = todayLogs.some(log => log.key === "breakIn");
    const hasBreakOut = todayLogs.some(log => log.key === "breakOut");
    const hasClockOut = todayLogs.some(log => log.key === "clockOut");

    // If already clocked out, disable all buttons
    if (hasClockOut) return false;

    switch (key) {
      case "clockIn":
        return !todayLogs.some(log => log.key === "clockIn");

      case "breakIn":
        return todayLogs.some(log => log.key === "clockIn") &&
          !todayLogs.some(log => log.key === "breakIn");

      case "breakOut":
        // Can break out only if broken in and not already broken out
        return todayLogs.some(log => log.key === "breakIn") &&
          !todayLogs.some(log => log.key === "breakOut");

      case "clockOut":
        return todayLogs.some(log => log.key === "clockIn") &&
          !todayLogs.some(log => log.key === "clockOut") &&
          (!hasBreakIn || hasBreakOut);

      default:
        return false;
    }
  };


  const weeklyReportData = getWeeklyReportData();

  return (
    <div className={styles.Dashboard}>
      <h1 className={styles.Dash_title}>Dashboard</h1>

      <div className={styles.Dashboard_widgets}>
        <div className={styles.Widget_top}>
          <div className={styles.Widget_left}>
            <div className={styles.Date}>
              <span>{new Date().toLocaleDateString("en-US", { weekday: "long" })}</span>
              <span>{new Date().getDate()}</span>
            </div>
            <span className={styles.Name}>{userData?.firstName} {userData?.surname}</span>
          </div>

          <div className={styles.Widget_right}>
            <div className={styles.Pause_con}>
              {/* <div
                className={isResume ? styles.Pause : styles.Resume}
                onClick={handleResume}
              >
                <span>{isResume ? "Pause" : "Resume"}</span>
                <img src={isResume ? Resume : Pause} alt={isResume ? "Resume Icon" : "Pause Icon"} />
              </div> */}
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
          ].map(({ label, key }) => (
            <div className={styles.Clockin1} key={key}>
              <div className={styles.Clock_widget}>
                <div className={styles.Clock_inner}>
                  <span>{label}</span>
                  <img className={styles.Eye} src={Eye} alt="eye" />
                </div>
                <span className={styles.Time_widget}>{timestamps[key]}</span>
              </div>
              <img
                className={styles.Camera}
                src={Camera}
                alt="camera"
                onClick={(e) => handleCameraButtonClick(e, key)}
                onMouseDown={(e) => e.preventDefault()}
                style={{
                  opacity: isButtonEnabled(key) ? 1 : 0.5,
                  cursor: isButtonEnabled(key) ? "pointer" : "not-allowed"
                }}
              />
            </div>
          ))}
        </div>
      </div>

      <div className={styles.Weekly}>
        <div className={styles.Weekly_head}>
          <span className={styles.ReportText}>Weekly Report</span>
          <button onClick={exportToCSV} className={styles.ExportButton}>
            Export to CSV
          </button>
          <button onClick={exportToExcel} className={styles.ExportButton}>
            Export to Excel
          </button>
          <div className={styles.Filter}>
            <img src={Filter} alt="Filter icon" />
            <span>Filter by date</span>
          </div>
        </div>

        {clockLog.length > 0 ? (
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
                      {day.image ? (
                        <img
                          src={day.image}
                          alt="Status"
                          style={{
                            width: "60px",
                            height: "60px",
                            borderRadius: "8px",
                            objectFit: "cover"
                          }}
                        />
                      ) : "—"}</td>
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