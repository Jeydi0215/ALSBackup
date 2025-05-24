import { useState, useEffect, useRef } from "react"; 
import styles from "../css/Dashboard.module.css";
import Camera from "../assets/camera.png";
import Eye from "../assets/eye.png";
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
import ClockModal from "./ClockModal"; 

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
  isAuto?: boolean;
  notes?: string;
}

interface DashboardProps {
  handleCameraClick: (key: string, isOffline?: boolean) => void;
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
  hasPending?: boolean;
}

class OfflineDB {
  private dbName: string;
  private dbVersion: number;
  private db: IDBDatabase | null = null;

  constructor(dbName: string, version = 1) {
    this.dbName = dbName;
    this.dbVersion = version;
  }

  async init(): Promise<void> {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(this.dbName, this.dbVersion);

      request.onerror = (event) => {
        console.error("IndexedDB error:", (event.target as IDBRequest).error);
        reject((event.target as IDBRequest).error);
      };

      request.onsuccess = (event) => {
        this.db = (event.target as IDBRequest).result;
        resolve();
      };

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBRequest).result;
        if (!db.objectStoreNames.contains('attendance')) {
          db.createObjectStore('attendance', { keyPath: 'localId' });
        }
        if (!db.objectStoreNames.contains('syncQueue')) {
          db.createObjectStore('syncQueue', { keyPath: 'localId' });
        }
      };
    });
  }

  async saveAttendance(data: any): Promise<string> {
    if (!this.db) await this.init();
    
    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(['attendance', 'syncQueue'], 'readwrite');
      const localId = Date.now().toString();
      
      const attendanceStore = transaction.objectStore('attendance');
      const syncStore = transaction.objectStore('syncQueue');
      
      const record = { ...data, localId, status: 'pending' };
      
      const attendanceRequest = attendanceStore.add(record);
      const syncRequest = syncStore.add(record);
      
      attendanceRequest.onsuccess = () => {
        syncRequest.onsuccess = () => resolve(localId);
        syncRequest.onerror = (e) => {
          console.error("Error adding to sync queue:", e);
          reject((e.target as IDBRequest).error);
        };
      };
      
      attendanceRequest.onerror = (e) => {
        console.error("Error saving attendance:", e);
        reject((e.target as IDBRequest).error);
      };
    });
  }

  async getPendingSyncItems(): Promise<any[]> {
    if (!this.db) await this.init();
    
    return new Promise((resolve) => {
      const transaction = this.db!.transaction('syncQueue', 'readonly');
      const store = transaction.objectStore('syncQueue');
      const request = store.getAll();
      
      request.onsuccess = () => resolve(request.result || []);
      request.onerror = () => resolve([]);
    });
  }

  async removeSyncedItem(localId: string): Promise<void> {
    if (!this.db) await this.init();
    
    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(['attendance', 'syncQueue'], 'readwrite');
      const attendanceStore = transaction.objectStore('attendance');
      const syncStore = transaction.objectStore('syncQueue');
      
      const attendanceRequest = attendanceStore.delete(localId);
      const syncRequest = syncStore.delete(localId);
      
      syncRequest.onsuccess = () => resolve();
      syncRequest.onerror = (e) => {
        console.error("Error removing synced item:", e);
        reject((e.target as IDBRequest).error);
      };
    });
  }
}

const offlineDB = new OfflineDB('AttendanceDB');
// default
const Dashboard: React.FC<DashboardProps> = ({ handleCameraClick }) => {
  const actionKeyRef = useRef<string>("clockIn");
  const { currentUser } = useAuth();
  const [userData, setUserData] = useState<UserData | null>(null);
  const [clockLog, setClockLog] = useState<ClockLogEntry[]>([]);
  const [time, setTime] = useState("");
  const [timestamps, setTimestamps] = useState({
    clockIn: "",
    breakIn: "",
    breakOut: "",
    clockOut: ""
  });
  const [isProcessing, setIsProcessing] = useState(false);
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [showOfflineAlert, setShowOfflineAlert] = useState(false);

 const syncPendingData = async () => {
  try {
    const pendingItems = await offlineDB.getPendingSyncItems();
    if (pendingItems.length === 0) {
      console.log("No offline records to sync.");
      return;
    }

    console.log(`Syncing ${pendingItems.length} offline records...`);

    const promises = pendingItems.map(async (item) => {
      const { localId, status, ...firebaseData } = item;

      try {
        await addDoc(collection(db, "clockLog"), firebaseData); // Save to Firestore
        await offlineDB.removeSyncedItem(localId); // Remove from IndexedDB
        console.log(`Synced and removed localId: ${localId}`);
      } catch (error) {
        console.error(`❌ Error syncing item ${localId}:`, error);
      }
    });

    await Promise.all(promises);
    console.log("✅ Sync complete.");
  } catch (error) {
    console.error("❌ Error during offline sync:", error);
  }
};


  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      syncPendingData();
    };
    const handleOffline = () => {
      setIsOnline(false);
      setShowOfflineAlert(true);
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    syncPendingData();

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

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
      q = query(
        collection(db, "clockLog"),
        where("status", "==", "pending"),
        orderBy("time", "desc")
      );
    } else {
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

      if (!currentUser.admin) {
        const today = new Date().toLocaleDateString("en-US", {
          month: "long",
          day: "2-digit",
          year: "numeric"
        });

        const newTimestamps = {
          clockIn: "-",
          breakIn: "-",
          breakOut: "-",
          clockOut: "-"
        };

        const todayLogs = logs.filter(log => log.date === today);
        
        todayLogs.forEach(log => {
          if (log.key && newTimestamps[log.key] === "-") {
            newTimestamps[log.key] = log.timeString;
          }
        });

        setTimestamps(newTimestamps);

        const userLogsToday = todayLogs.filter(log => log.uid === currentUser.uid);
        const hasClockIn = userLogsToday.some(log => log.key === "clockIn");
        const hasClockOut = userLogsToday.some(log => log.key === "clockOut");
        const hasAutoClockOut = userLogsToday.some(
          log => log.key === "clockOut" && log.timeString === "5:00 PM"
        );

        const now = new Date();
        const isAfter8PM = now.getHours() > 20 || (now.getHours() === 20 && now.getMinutes() >= 0);

        if (hasClockIn && !hasClockOut && !hasAutoClockOut && isAfter8PM && !isProcessing) {
          setIsProcessing(true);
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
    }, (error) => {
      console.error("Error fetching logs:", error);
    });

    return () => unsubscribe();
  }, [currentUser, isProcessing, userData]);

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

  const calculateWorkingHours = (
    clockInTime: string,
    breakInTime: string,
    breakOutTime: string,
    clockOutTime: string
  ) => {
    const isAutoClockOut = !clockOutTime &&
      (new Date().getHours() > 17 ||
        (new Date().getHours() === 17 && new Date().getMinutes() >= 30));
    const effectiveClockOut = isAutoClockOut ? "5:00 PM" : clockOutTime;

    if (!clockInTime || !effectiveClockOut) return "-";

    const clockInMinutes = parseTimeToMinutes(clockInTime);
    let startTimeMinutes = clockInMinutes;

    const EIGHT_AM = 8 * 60;
    const isEarlyClockIn = clockInMinutes < EIGHT_AM;
    if (isEarlyClockIn) {
      startTimeMinutes = EIGHT_AM;
    }

    const clockOutMinutes = parseTimeToMinutes(effectiveClockOut);
    let totalMinutes = clockOutMinutes - startTimeMinutes;

    if (breakInTime && breakOutTime) {
      const breakInMinutes = parseTimeToMinutes(breakInTime);
      const breakOutMinutes = parseTimeToMinutes(breakOutTime);
      totalMinutes -= (breakOutMinutes - breakInMinutes);
    }

    if (totalMinutes <= 0) return "0m";

    const hours = Math.floor(totalMinutes / 60);
    const minutes = totalMinutes % 60;

    let suffix = "";
    if (isAutoClockOut) suffix += "*";
    if (isEarlyClockIn) suffix += "⁑";

    return `${hours > 0 ? `${hours}h ` : ""}${minutes}m${suffix}`;
  };

 const handleCameraButtonClick = async (e: React.MouseEvent, key: string) => {
  e.preventDefault();
  e.stopPropagation();

  if (!isButtonEnabled(key)) {
    alert(`You have already submitted your "${key.replace(/([A-Z])/g, ' $1')}" today.`);
    return;
  }

  actionKeyRef.current = key; // store the current action (clockIn, breakIn, etc.)

  handleCameraClick(key, !isOnline); // true if offline
};

  const getWeeklyReportData = (): WeeklyReportDay[] => {
    const now = new Date();
    const sevenDaysAgo = new Date(now);
    sevenDaysAgo.setDate(now.getDate() - 6);

    const dates: Record<string, WeeklyReportDay> = {};

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

      if (!dates[groupKey]) {
        dates[groupKey] = {
          date: logDateStr,
          workingHours: "",
          userId: log.uid,
          logIds: [],
          employeeName: currentUser?.admin 
            ? `${log.userFirstName || ''} ${log.userSurname || ''}`.trim()
            : undefined,
          isComplete: false,
          hasPending: true
        };
      }

      dates[groupKey].logIds.push(log.id);
      
      if (!dates[groupKey][log.key]) {
        dates[groupKey][log.key] = log.timeString;
      }

      dates[groupKey].status = log.status;
    });

    Object.values(dates).forEach(day => {
      day.workingHours = calculateWorkingHours(
        day.clockIn || "",
        day.breakIn || "",
        day.breakOut || "",
        day.clockOut || ""
      );
      
      day.isComplete = !!day.clockIn && !!day.clockOut;
    });

    return Object.values(dates).sort((a, b) => 
      new Date(b.date).getTime() - new Date(a.date).getTime()
    );
  };

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

    if (hasClockOut) return false;

    switch (key) {
      case "clockIn":
        return !todayLogs.some(log => log.key === "clockIn");

      case "breakIn":
        return todayLogs.some(log => log.key === "clockIn") &&
          !todayLogs.some(log => log.key === "breakIn");

      case "breakOut":
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
const handleClockLogSubmit = async (
  image: string,
  timestamp: string,
  imageUrl?: string,
  location?: {
    latitude: number;
    longitude: number;
    address?: string;
  }
) => {
  try {
    const now = new Date();
    const formattedDate = now.toLocaleDateString("en-US", {
      month: "long",
      day: "2-digit",
      year: "numeric"
    });

    const data = {
      uid: currentUser?.uid,
      key: actionKeyRef.current, // We'll explain this below
      time: Timestamp.now(),
      timeString: timestamp,
      date: formattedDate,
      status: "pending",
      imageUrl: imageUrl || "",
      userFirstName: userData?.firstName || "",
      userSurname: userData?.surname || "",
      isAuto: false,
      notes: "",
      location,
    };

    await addDoc(collection(db, "clockLog"), data);
    console.log("Clock log saved to Firestore");
  } catch (error) {
    console.error("Error saving clock log to Firestore:", error);
  }
};

  const weeklyReportData = getWeeklyReportData();

  return (
    <div className={styles.Dashboard}>
      <h1 className={styles.Dash_title}>Dashboard</h1>

      {showOfflineAlert && !isOnline && (
        <div className={styles.OfflineAlert}>
          <p>You are currently offline. Your attendance will be saved locally and synced when you're back online.</p>
          <button onClick={() => setShowOfflineAlert(false)}>Dismiss</button>
        </div>
      )}

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
          <div className={styles.Head_button}>
            <button style={{ marginRight: 5 }} onClick={exportToCSV} className={styles.ExportButton}>
              Export to CSV
            </button>
            <button onClick={exportToExcel} className={styles.ExportButton}>
              Export to Excel
            </button>
          </div>
        </div>

        {clockLog.length > 0 ? (
          <div className={styles.WeeklyTable}>
            <div className={styles.Clock_day}>
              <div className={styles.Clock_morning}>
                <h2>Morning:</h2>
                <table>
                  <thead>
                    <tr>
                      {currentUser?.admin && <th>Employee</th>}
                      <th>Date</th>
                      <th>Clock In</th>
                      <th>Break In</th>
                    </tr>
                  </thead>
                  <tbody>
                    {weeklyReportData.map((entry, index) => {
                      const employeeName = entry.employeeName || "Unknown User";

                      return (
                        <tr key={index}>
                          {currentUser?.admin && <td>{employeeName}</td>}
                          <td>{entry.date}</td>
                          <td>{entry.clockIn || "-"}</td>
                          <td>{entry.breakIn || "-"}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              <div className={styles.Clock_afternoon}>
                <h2>Afternoon:</h2>
                <table>
                  <thead>
                    <tr>
                      {currentUser?.admin && <th>Employee</th>}
                      <th>Date</th>
                      <th>Break Out</th>
                      <th>Clock Out</th>
                    </tr>
                  </thead>
                  <tbody>
                    {weeklyReportData.map((entry, index) => {
                      const employeeName = entry.employeeName || "Unknown User";
                      const statusText = entry.status || "-";
                      const statusStyle = {
                        color:
                          entry.status === 'approved' ? 'green' :
                          entry.status === 'rejected' ? 'red' :
                          entry.status === 'pending'  ? 'orange' :
                          'inherit'
                      };

                      return (
                        <tr key={index}>
                          {currentUser?.admin && <td>{employeeName}</td>}
                          <td>{entry.date}</td>
                          <td>{entry.breakOut || "-"}</td>
                          <td>{entry.clockOut || "-"}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>

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