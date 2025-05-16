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
  onSnapshot,
  writeBatch,
  addDoc,
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
  status?: string;
  userFirstName?: string;
  userSurname?: string;
}

interface DashboardProps {
  handleCameraClick: (key: string) => void; 
  showCamera: boolean;
}

interface WeeklyReportDay {
  id?: string;
  date: string;
  clockIn?: string;
  breakIn?: string;
  breakOut?: string;
  clockOut?: string;
  workingHours: string;
  status?: string;
  userId?: string;
  logIds: string[];
  employeeName?: string;
  isComplete: boolean;
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
  const [isProcessing, setIsProcessing] = useState(false);

  // Helper function to parse time string to minutes
  const parseTimeToMinutes = (timeStr: string): number => {
    if (!timeStr) return 0;
    const [time, period] = timeStr.split(" ");
    let [hours, minutes] = time.split(":").map(Number);
    if (period === "PM" && hours < 12) hours += 12;
    if (period === "AM" && hours === 12) hours = 0;
    return hours * 60 + minutes;
  };



  const exportToExcel = () => {
    const weeklyData = getWeeklyReportData();

    const worksheetData = weeklyData.map((entry) => ({
      ...(currentUser?.admin && { 
        "Employee": entry.employeeName || "Unknown User"
      }),
      "Date": entry.date,
      "Clock In": entry.clockIn || "-",
      "Break In": entry.breakIn || "-",
      "Break Out": entry.breakOut || "-",
      "Clock Out": entry.clockOut || 
                  (new Date().getHours() > 17 || 
                   (new Date().getHours() === 17 && new Date().getMinutes() >= 30) 
                   ? "5:00 PM (auto)" 
                   : "-"),
      "Working Hours": entry.workingHours || "-",
      "Status": entry.status || (currentUser?.admin ? "approved" : "-"),
      "Notes": [
        !entry.clockOut && 
          (new Date().getHours() > 17 || 
           (new Date().getHours() === 17 && new Date().getMinutes() >= 30)) 
          ? "Clock-out automatically set to 5:00 PM" 
          : "",
        entry.clockIn && parseTimeToMinutes(entry.clockIn) < 8 * 60
          ? "Early clock-in adjusted to 8:00 AM"
          : ""
      ].filter(note => note).join("; ") || "Normal schedule"
    }));

    const worksheet = XLSX.utils.json_to_sheet(worksheetData);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Time Report");

    const today = new Date().toISOString().split('T')[0];
    const fileName = currentUser?.admin 
      ? `employee_time_report_${today}.xlsx` 
      : `my_time_report_${today}.xlsx`;

    XLSX.writeFile(workbook, fileName);
  };

  const exportToCSV = () => {
    const weeklyData = getWeeklyReportData();

    const csvData = weeklyData.map((entry) => ({
      ...(currentUser?.admin && { 
        "Employee": entry.employeeName || "Unknown User"
      }),
      "Date": entry.date,
      "Clock In": entry.clockIn || "-",
      "Break In": entry.breakIn || "-",
      "Break Out": entry.breakOut || "-",
      "Clock Out": entry.clockOut || 
                  (new Date().getHours() > 17 || 
                   (new Date().getHours() === 17 && new Date().getMinutes() >= 30) 
                   ? "5:00 PM (auto)" 
                   : "-"),
      "Working Hours": entry.workingHours || "-",
      "Status": entry.status || (currentUser?.admin ? "approved" : "-"),
      "Notes": [
        !entry.clockOut && 
          (new Date().getHours() > 17 || 
           (new Date().getHours() === 17 && new Date().getMinutes() >= 30)) 
          ? "Clock-out automatically set to 5:00 PM" 
          : "",
        entry.clockIn && parseTimeToMinutes(entry.clockIn) < 8 * 60
          ? "Early clock-in adjusted to 8:00 AM"
          : ""
      ].filter(note => note).join("; ") || "Normal schedule"
    }));

    const csv = Papa.unparse(csvData, {
      quotes: true,
      header: true,
      delimiter: ","
    });

    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);

    const today = new Date().toISOString().split('T')[0];
    const fileName = currentUser?.admin 
      ? `employee_time_report_${today}.csv` 
      : `my_time_report_${today}.csv`;

    const link = document.createElement("a");
    link.href = url;
    link.setAttribute("download", fileName);
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

  useEffect(() => {
    if (!currentUser) return;

    let q;

    if (currentUser.admin) {
      // Admin sees all pending logs and their own logs
      q = query(
        collection(db, "clockLog"),
        where("status", "in", ["pending", "approved", "rejected"]),
        orderBy("time", "desc")
      );
    } else {
      // Regular user sees only their own logs
      q = query(
        collection(db, "clockLog"),
        where("uid", "==", currentUser.uid),
        orderBy("time", "desc")
      );
    }

    const unsubscribe = onSnapshot(q, async (querySnapshot) => {
      const logs = querySnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as ClockLogEntry[];
      
      setClockLog(logs);

      // Auto clock out logic for regular users
if (!currentUser.admin) {
  const today = new Date().toLocaleDateString("en-US", {
        month: "long",
        day: "2-digit",
        year: "numeric"
      });
  const userLogsToday = logs.filter(log => log.date === today && log.uid === currentUser.uid);

  const hasClockIn = userLogsToday.some(log => log.key === "clockIn");
  const hasClockOut = userLogsToday.some(log => log.key === "clockOut");
  const hasAutoClockOut = userLogsToday.some(
        log => log.key === "clockOut" && log.timeString === "5:00 PM"
      );

  const now = new Date();
  const isAfter8PM = now.getHours() > 20 || (now.getHours() === 20 && now.getMinutes() >= 0);
  

  console.log('Current time:', now, 'Is after 8:00 PM?', isAfter8PM);
      console.log('Today:', today);
      console.log('User logs today:', userLogsToday);
      console.log('Has clock in?', hasClockIn, 
                 'Has clock out?', hasClockOut,
                 'Has auto clock out?', hasAutoClockOut);
      

  // Change this condition
if (hasClockIn && !hasClockOut && !hasAutoClockOut && isAfter8PM && !isProcessing) {
        setIsProcessing(true);
        console.log('Creating auto clock-out...');

        try {

          await addDoc(collection(db, "clockLog"), {
            uid: currentUser.uid,
            key: "clockOut",
            time: null,
            timeString: "NULL (Missed 8PM)",
            date: today,
            status: "pending",
            imageUrl: "",
            userFirstName: userData?.firstName,
            userSurname: userData?.surname,
            isAuto: true,
            notes: "Employee failed to clock out by 8:00 PM cutoff"
          });
        } catch (err) {
          console.error("Auto clock-out failed:", err);
        } finally {
          setIsProcessing(false);
        }
      }
  }



      // Only update timestamps for non-admin users
      if (!currentUser.admin) {
        const latestEntries = logs.reduce((acc, log) => {
          if (log.key && !acc[log.key]) {
            acc[log.key] = log.timeString;
          }
          return acc;
        }, {} as Record<string, string>);

        setTimestamps(prev => ({ ...prev, ...latestEntries }));
      }
    }, (error) => {
      console.error("Error fetching logs:", error);
    });

    return () => unsubscribe();
  }, [currentUser, isProcessing, userData]);

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

  // Updated calculateWorkingHours function
  const calculateWorkingHours = (
    clockInTime: string,
    breakInTime: string,
    breakOutTime: string,
    clockOutTime: string
  ) => {
    // Handle auto-clock-out at 5:00 PM if after 5:30 PM
    const isAutoClockOut = !clockOutTime && 
      (new Date().getHours() > 17 || 
       (new Date().getHours() === 17 && new Date().getMinutes() >= 30));
    const effectiveClockOut = isAutoClockOut ? "5:00 PM" : clockOutTime;

    if (!clockInTime || !effectiveClockOut) return "-";

    // Convert times to minutes since midnight
    const clockInMinutes = parseTimeToMinutes(clockInTime);
    let startTimeMinutes = clockInMinutes;
    
    // If clock-in is before 8 AM (480 minutes), use 8 AM as start time
    const EIGHT_AM = 8 * 60; // 8 AM in minutes
    const isEarlyClockIn = clockInMinutes < EIGHT_AM;
    if (isEarlyClockIn) {
      startTimeMinutes = EIGHT_AM;
    }

    const clockOutMinutes = parseTimeToMinutes(effectiveClockOut);
    let totalMinutes = clockOutMinutes - startTimeMinutes;

    // Handle break time if exists
    if (breakInTime && breakOutTime) {
      const breakInMinutes = parseTimeToMinutes(breakInTime);
      const breakOutMinutes = parseTimeToMinutes(breakOutTime);
      totalMinutes -= (breakOutMinutes - breakInMinutes);
    }

    if (totalMinutes <= 0) return "0m";

    const hours = Math.floor(totalMinutes / 60);
    const minutes = totalMinutes % 60;
    
    // Add indicators for special cases
    let suffix = "";
    if (isAutoClockOut) suffix += "*";
    if (isEarlyClockIn) suffix += "⁑";
    
    return `${hours > 0 ? `${hours}h ` : ""}${minutes}m${suffix}`;
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

  const getWeeklyReportData = (): WeeklyReportDay[] => {
    const now = new Date();
    const sevenDaysAgo = new Date(now);
    sevenDaysAgo.setDate(now.getDate() - 6);

    const dates: Record<string, WeeklyReportDay> = {};

    // Group logs by user and date
    const userDateGroups: Record<string, ClockLogEntry[]> = {};

    clockLog.forEach(log => {
      if (!log.time || !log.key || !log.timeString) return;
      
      const logDateObj = log.time instanceof Timestamp ? log.time.toDate() : new Date(log.time);
      const logDateStr = logDateObj.toLocaleDateString("en-US", {
        month: "long",
        day: "2-digit",
        year: "numeric",
      });

      if (logDateObj < sevenDaysAgo || logDateObj > now) return;

      const groupKey = currentUser?.admin 
        ? `${log.uid}_${logDateStr}` 
        : logDateStr;

      if (!userDateGroups[groupKey]) {
        userDateGroups[groupKey] = [];
      }
      userDateGroups[groupKey].push(log);
    });

    // Process each day's logs
    Object.entries(userDateGroups).forEach(([key, dayLogs]) => {
      const dateKey = currentUser?.admin ? key.split('_')[1] : key;
      const userId = currentUser?.admin ? key.split('_')[0] : currentUser?.uid;

      if (!dates[dateKey]) {
        dates[dateKey] = {
          date: dateKey,
          workingHours: "",
          userId,
          logIds: [],
          employeeName: currentUser?.admin 
            ? `${dayLogs[0]?.userFirstName || ''} ${dayLogs[0]?.userSurname || ''}`.trim() 
            : undefined,
          isComplete: false
        };
      }

      dayLogs.forEach(log => {
        dates[dateKey].logIds.push(log.id);
        
        if (["clockIn", "breakIn", "breakOut", "clockOut"].includes(log.key)) {
          if (!dates[dateKey][log.key]) {
            dates[dateKey][log.key] = log.timeString;
          }
          // Use clockIn status for the whole day
          if (log.key === "clockIn" && log.status) {
            dates[dateKey].status = log.status;
          }
        }
      });

      // Check if the day is complete (has both clockIn and clockOut)
    const hasClockIn = dayLogs.some(log => log.key === "clockIn");
    const hasClockOut = dayLogs.some(log => log.key === "clockOut");
    dates[dateKey].isComplete = hasClockIn && hasClockOut;
  });

    // Calculate working hours for each day
    Object.values(dates).forEach(day => {
      day.workingHours = calculateWorkingHours(
        day.clockIn || "",
        day.breakIn || "",
        day.breakOut || "",
        day.clockOut || ""
      );
    });

    return Object.values(dates).sort((a, b) => 
      new Date(b.date).getTime() - new Date(a.date).getTime()
    );
  };

// Update approval/rejection handlers
const handleApprove = async (logIds: string[]) => {
  setIsProcessing(true);
  try {
    const batch = writeBatch(db);
    logIds.forEach(logId => {
      const logRef = doc(db, "clockLog", logId);
      batch.update(logRef, { status: "approved" });
    });
    await batch.commit();
  } catch (error) {
    console.error("Error approving logs:", error);
  } finally {
    setIsProcessing(false);
  }
};

const handleReject = async (logIds: string[]) => {
  setIsProcessing(true);
  try {
    const batch = writeBatch(db);
    logIds.forEach(logId => {
      const logRef = doc(db, "clockLog", logId);
      batch.update(logRef, { status: "rejected" });
    });
    await batch.commit();
  } catch (error) {
    console.error("Error rejecting logs:", error);
  } finally {
    setIsProcessing(false);
  }
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

      {/* Widgets section - only for non-admin users */}
      {!currentUser?.admin && (
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
                <span className={styles.Time_widget}>{timestamps[key] || "-"}</span>
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
)}
      <div className={styles.Weekly}>
        <div className={styles.Weekly_head}>
          <span className={styles.ReportText}>
            {currentUser?.admin ? "Employee Time Logs" : "Weekly Report"}
          </span>
          <div>
            <button style={{marginRight: 5}} onClick={exportToCSV} className={styles.ExportButton}>
              Export to CSV
            </button>
            <button onClick={exportToExcel} className={styles.ExportButton}>
              Export to Excel
            </button>
          </div>
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
                  {currentUser?.admin && <th>Employee</th>}
                  <th>Date</th>
                  <th>Clock In</th>
                  <th>Break In</th>
                  <th>Break Out</th>
                  <th>Clock Out</th>
                  <th>Working Hours</th>
                  <th>Status</th>
                  {currentUser?.admin && <th>Actions</th>}
                </tr>
              </thead>
              <tbody>
                {weeklyReportData.map((day, index) => {
                  const employeeName = day.employeeName || "Unknown User";
                  const statusText = day.status || (currentUser?.admin ? "approved" : "-");
                  const statusStyle = {
                    color: day.status === 'approved' ? 'green' :
                          day.status === 'rejected' ? 'red' :
                          day.status === 'pending' ? 'orange' : 'inherit'
                  };

                  return (
                    <tr key={index}>
                      {currentUser?.admin && <td>{employeeName}</td>}
                      <td>{day.date}</td>
                      <td>{day.clockIn || "-"}</td>
                      <td>{day.breakIn || "-"}</td>
                      <td>{day.breakOut || "-"}</td>
                      <td>
                        {day.clockOut || 
                         (new Date().getHours() > 17 || 
                          (new Date().getHours() === 17 && new Date().getMinutes() >= 30) 
                          ? "5:00 PM*" 
                          : "-")}
                      </td>
                      <td>{day.workingHours || "-"}</td>
                      <td style={statusStyle}>{statusText}</td>
                      {currentUser?.admin && (
                        <td>
                          {day.status === "pending" && day.isComplete ? (
                            <>
                              <button
                                style={{ marginRight: 5 }}
                                onClick={() => {
                                  if (window.confirm(`Approve all time entries for ${day.date}?`)) {
                                    handleApprove(day.logIds);
                                  }
                                }}
                                className={styles.ApproveButton}
                                disabled={isProcessing}
                              >
                                Approve
                              </button>
                              <button
                                onClick={() => {
                                  if (window.confirm(`Reject all time entries for ${day.date}?`)) {
                                    handleReject(day.logIds);
                                  }
                                }}
                                className={styles.RejectButton}
                                disabled={isProcessing}
                              >
                                Reject
                              </button>
                            </>
                          ) : day.status === "pending" ? (
      <span title="Cannot approve/reject until clock-out is recorded">Pending clock-out</span>
    ) : (
      <span>-</span>
    )}
  </td>
)}
                    </tr>
                  );
                })}
              </tbody>
            </table>
            <div style={{ 
              textAlign: 'right', 
              fontSize: '0.8rem', 
              color: '#666', 
              marginTop: '10px',
              display: 'flex',
              justifyContent: 'flex-end',
              gap: '20px'
            }}>
              <span>* Auto null at when no clock out until 8:00 PM</span>
              <span>⁑ Early clock-in adjusted to 8:00 AM</span>
            </div>
          </div>
        ) : (
          <p style={{ padding: "1rem", color: "#888" }}>
            No clock-in records found.
          </p>
        )}
      </div>
    </div>
  );
};

export default Dashboard;