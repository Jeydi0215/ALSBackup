import { useState, useEffect } from "react";
import styles from "../css/History.module.css";
import { useAuth } from "../context/AuthContext";
import { collection, query, where, orderBy, getDocs, doc, writeBatch, Timestamp, getDoc } from "firebase/firestore";
import { db } from "../firebase";
import * as XLSX from "xlsx";
import { saveAs } from "file-saver";
import dayjs from "dayjs";
import isBetween from "dayjs/plugin/isBetween";
import isSameOrAfter from "dayjs/plugin/isSameOrAfter";
import isSameOrBefore from "dayjs/plugin/isSameOrBefore";

dayjs.extend(isBetween);
dayjs.extend(isSameOrAfter);
dayjs.extend(isSameOrBefore);
interface Employee {
  id: string;
  firstName: string;
  surname: string;
}

interface DailyLog {
  date: string;
  clockIn?: string;
  breakOut?: string;
  breakIn?: string;
  clockOut?: string;
  workingHours: string;
  status: string;
  logIds: string[];
}

interface LogDetails {
  imageUrl?: string;
  location?: {
    coordinates: {
      latitude: number;
      longitude: number;
    };
    address?: string;
    timestamp?: Timestamp;
  };
  timeString: string;
  date: string;
  key: string;
  status: string;
}

interface ClockLogEntry {
  id: string;
  uid: string;
  key: string;
  time?: Timestamp;
  timeString: string;
  date: string;
  imageUrl?: string;
  status?: string;
  location?: {
    coordinates: {
      latitude: number;
      longitude: number;
    };
    address?: string;
    timestamp?: Timestamp;
  };
}

const History = () => {
  const { currentUser } = useAuth();
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [selectedEmployee, setSelectedEmployee] = useState("");
  const [dailyLogs, setDailyLogs] = useState<DailyLog[]>([]);
  const [loading, setLoading] = useState(false);
  const [filter, setFilter] = useState("all"); // 'all' | 'week' | 'month'
  const [selectedLog, setSelectedLog] = useState<LogDetails | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [allLogs, setAllLogs] = useState<ClockLogEntry[]>([]); // Add this to your state


  // Fetch all employees (admin only)
  useEffect(() => {
    if (!currentUser?.admin) return;

    const fetchEmployees = async () => {
      const q = query(collection(db, "users"), where("isEmployee", "==", true));
      const snapshot = await getDocs(q);
      const data = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as Employee[];
      setEmployees(data);
      if (data.length > 0) setSelectedEmployee(data[0].id);
    };

    fetchEmployees();
  }, [currentUser]);

  // Fetch and group logs by date
  useEffect(() => {
    if (!selectedEmployee) return;

    const fetchLogs = async () => {
  setLoading(true);
  try {
    const q = query(
      collection(db, "clockLog"),
      where("uid", "==", selectedEmployee),
      orderBy("time", "desc")
    );
    const snapshot = await getDocs(q);

    const logs = snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    })) as ClockLogEntry[];
    
    setAllLogs(logs);

        // Group logs by date
        const logsByDate: Record<string, DailyLog> = {};
        snapshot.forEach(doc => {
          const log = doc.data();
          const date = log.date;

          if (!logsByDate[date]) {
            logsByDate[date] = {
              date,
              workingHours: "0h",
              status: "pending",
              logIds: []
            };
          }

          // Add the punch time
          logsByDate[date][log.key] = log.timeString;
          logsByDate[date].logIds.push(doc.id);
          logsByDate[date].status = log.status || "pending";
        });

        // Calculate working hours for each day
        Object.values(logsByDate).forEach(day => {
          day.workingHours = calculateWorkingHours(
            day.clockIn,
            day.breakOut,
            day.breakIn,
            day.clockOut
          );
        });

        setDailyLogs(Object.values(logsByDate));
      } catch (error) {
        console.error("Error fetching logs:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchLogs();
  },);

  const parseTimeToMinutes = (timeStr?: string): number | null => {
    if (!timeStr) return null;

    const [time, period] = timeStr.split(' ');
    const [hours, minutes] = time.split(':').map(Number);

    let totalMinutes = hours * 60 + minutes;
    if (period === 'PM' && hours < 12) totalMinutes += 12 * 60;
    if (period === 'AM' && hours === 12) totalMinutes -= 12 * 60;

    return totalMinutes;
  };

  const calculateWorkingHours = (
    clockIn?: string,
    breakOut?: string,
    breakIn?: string,
    clockOut?: string
  ): string => {
    // Handle null clock-out after 8PM
    if (clockOut === null || clockOut === "NULL (Missed 8PM)") {
      return "0h (Missing Clock-out)";
    }

    // Early clock-in adjustment (before 8AM becomes 8AM)
    const clockInMinutes = parseTimeToMinutes(clockIn) ?? 8 * 60;
    const adjustedClockIn = Math.max(clockInMinutes, 8 * 60); // 8AM minimum

    // Clock-out adjustment (5PM-8PM becomes 5PM)
    let clockOutMinutes = parseTimeToMinutes(clockOut);
    if (clockOutMinutes && clockOutMinutes >= 17 * 60 && clockOutMinutes <= 20 * 60) {
      clockOutMinutes = 17 * 60; // 5PM
    }

    // If no valid clock-out, return 0 hours
    if (!clockOutMinutes) return "0h";

    // Calculate total minutes worked
    let totalMinutes = clockOutMinutes - adjustedClockIn;

    // Deduct lunch break (12PM-1PM) if taken
    const tookLunch = breakOut && breakIn;
    if (tookLunch) {
      const lunchStart = 12 * 60; // 12PM
      const lunchEnd = 13 * 60;   // 1PM
      const breakOutMinutes = parseTimeToMinutes(breakOut) ?? lunchStart;
      const breakInMinutes = parseTimeToMinutes(breakIn) ?? lunchEnd;

      // Only deduct if lunch was taken during working hours
      if (breakOutMinutes >= adjustedClockIn && breakInMinutes <= clockOutMinutes) {
        totalMinutes -= (breakInMinutes - breakOutMinutes);
      }
    }

    // Calculate hours and minutes
    if (totalMinutes <= 0) return "0h";

    const hours = Math.floor(totalMinutes / 60);
    const minutes = totalMinutes % 60;

    // Add indicators for special cases
    let suffix = "";
    if (clockInMinutes < 8 * 60) suffix += "⁑"; // Early clock-in
    if (clockOutMinutes === 17 * 60 && parseTimeToMinutes(clockOut) !== 17 * 60) {
      suffix += "*"; // Adjusted clock-out
    }

    return `${hours}h${minutes > 0 ? ` ${minutes}m` : ''}${suffix}`;
  };

  const handleStatusChange = async (date: string, newStatus: string) => {
    if (!currentUser?.admin) return;

    try {
      // Find all logs for this date
      const dayLogs = dailyLogs.find(log => log.date === date);
      if (!dayLogs) return;

      // Batch update all logs for this day
      const batch = writeBatch(db);
      dayLogs.logIds.forEach(logId => {
        const logRef = doc(db, "clockLog", logId);
        batch.update(logRef, { status: newStatus.toLowerCase() });
      });

      await batch.commit();

      // Update local state
      setDailyLogs(prev => prev.map(log =>
        log.date === date ? { ...log, status: newStatus } : log
      ));
    } catch (error) {
      console.error("Error updating status:", error);
    }
  };

  const filterLogs = () => {
    const today = dayjs();
    return dailyLogs.filter(log => {
      const logDate = dayjs(log.date);

      if (filter === "week") {
        return logDate.isSame(today, 'week');
      } else if (filter === "month") {
        return logDate.isSame(today, 'month');
      }
      return true; // default is 'all'
    });
  };


  const handleGenerateReport = () => {
    const logsToExport = filterLogs();

    const worksheetData = logsToExport.map(log => ({
      Date: log.date,
      "Clock In": log.clockIn || "-",
      "Break Out": log.breakOut || "-",
      "Break In": log.breakIn || "-",
      "Clock Out": log.clockOut || "-",
      "Working Hours": log.workingHours,
      Status: log.status,
    }));

    const worksheet = XLSX.utils.json_to_sheet(worksheetData);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Report");

    const selectedEmployeeObj = employees.find(e => e.id === selectedEmployee);
    const filename = `Report_${selectedEmployeeObj?.firstName}_${selectedEmployeeObj?.surname}_${filter}_${dayjs().format("YYYY-MM-DD")}.xlsx`;

    const excelBuffer = XLSX.write(workbook, { bookType: "xlsx", type: "array" });
    const blob = new Blob([excelBuffer], { type: "application/octet-stream" });
    saveAs(blob, filename);
  };


  const selectedEmployeeName = employees.find(e => e.id === selectedEmployee)
    ? `${employees.find(e => e.id === selectedEmployee)?.firstName} ${employees.find(e => e.id === selectedEmployee)?.surname}'s History`
    : "Employee History";

  const showLogDetails = async (logId: string) => {
  try {
    const logRef = doc(db, "clockLog", logId);
    const logSnap = await getDoc(logRef);
    
    if (logSnap.exists()) {
      const logData = logSnap.data();
      setSelectedLog({
        imageUrl: logData.imageUrl,
        location: logData.location,
        timeString: logData.timeString,
        date: logData.date,
        key: logData.key,
        status: logData.status
      });
      setShowModal(true);
    }
  } catch (error) {
    console.error("Error fetching log details:", error);
  }
};

  return (
  <div className={styles.History}>
    <div className={styles.List_head}>
      {currentUser?.admin ? (
        <select
          value={selectedEmployee}
          onChange={(e) => setSelectedEmployee(e.target.value)}
          className={styles.EmployeeDropdown}
        >
          {employees.map(employee => (
            <option key={employee.id} value={employee.id}>
              History of {employee.firstName} {employee.surname}
            </option>
          ))}
        </select>
      ) : (
        <span>{selectedEmployeeName}</span>
      )}
    </div>

    <div className={styles.List_inner}>
      <div className={styles.List_buttons}>
        <select value={filter} onChange={(e) => setFilter(e.target.value)}>
          <option value="all">All</option>
          <option value="week">This Week</option>
          <option value="month">This Month</option>
        </select>
        <button onClick={handleGenerateReport}>Generate Report</button>
      </div>

      <table>
        <thead>
          <tr>
            <th>Date</th>
            <th>Clock In</th>
            <th>Clock Out</th>
            <th>Status</th>
          </tr>
        </thead>
        <tbody>
          {dailyLogs.map(day => (
            <tr key={day.date}>
              <td>{day.date}</td>
              <td 
  className={styles.ClickableCell}
  onClick={() => {
    if (day.clockIn) {
      // Find the clockIn log ID
      const clockInLogId = day.logIds.find(id => {
        const log = allLogs.find(l => l.id === id);
        return log?.key === "clockIn";
      });
      if (clockInLogId) showLogDetails(clockInLogId);
    }
  }}
>
  {day.clockIn || "-"}
</td>
<td 
  className={styles.ClickableCell}
  onClick={() => {
    if (day.clockOut) {
      // Find the clockOut log ID
      const clockOutLogId = day.logIds.find(id => {
        const log = allLogs.find(l => l.id === id);
        return log?.key === "clockOut";
      });
      if (clockOutLogId) showLogDetails(clockOutLogId);
    }
  }}
>
  {day.clockOut || "-"}
</td>
              <td>
                <select
                  value={day.status}
                  onChange={(e) => handleStatusChange(day.date, e.target.value)}
                  disabled={!currentUser?.admin}
                >
                  <option value="pending">Pending</option>
                  <option value="approved">Approved</option>
                  <option value="rejected">Rejected</option>
                </select>
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {/* Modal for log details */}
      {showModal && selectedLog && (
        <div className={styles.ModalOverlay} onClick={() => setShowModal(false)}>
          <div className={styles.ModalContent} onClick={e => e.stopPropagation()}>
            <button 
              className={styles.CloseButton} 
              onClick={() => setShowModal(false)}
            >
              ×
            </button>
            
            <h3>{selectedLog.key.toUpperCase()} Details</h3>
            <p>Date: {selectedLog.date}</p>
            <p>Time: {selectedLog.timeString}</p>
            <p>Status: {selectedLog.status}</p>
            
            {selectedLog.imageUrl && (
              <div className={styles.ImageContainer}>
                <img 
                  src={selectedLog.imageUrl} 
                  alt="Verification photo" 
                  className={styles.VerificationImage}
                />
              </div>
            )}
            
            {selectedLog.location && (
              <div className={styles.LocationInfo}>
                <h4>Location Information</h4>
                <p>Address: {selectedLog.location.address || "Not available"}</p>
                <p>
                  Coordinates: {selectedLog.location.coordinates.latitude.toFixed(6)}, 
                  {selectedLog.location.coordinates.longitude.toFixed(6)}
                </p>
                <div className={styles.MapLink}>
                  <a
                    href={`https://www.google.com/maps?q=${selectedLog.location.coordinates.latitude},${selectedLog.location.coordinates.longitude}`}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    View on Google Maps
                  </a>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  </div>
);
};

export default History;