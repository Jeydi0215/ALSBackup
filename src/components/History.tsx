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
import html2pdf from "html2pdf.js";
import dtrStyles from "../css/DTR.css?inline";

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
  const [selectedMonthForDTR, setSelectedMonthForDTR] = useState<string>("");


  const fetchPhilippineHolidays = async (): Promise<Record<string, string>> => {
    const res = await fetch("https://date.nager.at/api/v3/PublicHolidays/2025/PH");
    const data = await res.json();

    const holidayMap: Record<string, string> = {};
    data.forEach((item: any) => {
      holidayMap[item.date] = item.localName;
    });

    return holidayMap;
  };



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
  const rawClockIn = parseTimeToMinutes(clockIn);
  const rawClockOut = parseTimeToMinutes(clockOut);

  // Invalid or missing clock-in/out
  if (rawClockIn === null || rawClockOut === null) return "0h";

  // No actual working time
  if (rawClockIn === rawClockOut) return "0h (No work)";

  const adjustedClockIn = Math.max(rawClockIn, 8 * 60); // 8:00 AM minimum
  let adjustedClockOut = rawClockOut;

  // Adjust clock-out to 5:00 PM if it's between 5:00 PM and 8:00 PM
  if (adjustedClockOut >= 17 * 60 && adjustedClockOut <= 20 * 60) {
    adjustedClockOut = 17 * 60;
  }

  let totalMinutes = adjustedClockOut - adjustedClockIn;

  // Deduct break if taken
  const tookLunch = breakOut && breakIn;
  if (tookLunch) {
    const breakOutMinutes = parseTimeToMinutes(breakOut) ?? (12 * 60);
    const breakInMinutes = parseTimeToMinutes(breakIn) ?? (13 * 60);
    if (breakOutMinutes >= adjustedClockIn && breakInMinutes <= adjustedClockOut) {
      totalMinutes -= (breakInMinutes - breakOutMinutes);
    }
  }

  if (totalMinutes <= 0) return "0h";

  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;

  // Add suffix if auto-adjusted
  let suffix = "";
  if (rawClockIn < 8 * 60) suffix += "⁑";
  if (rawClockOut >= 17 * 60 && rawClockOut <= 20 * 60) suffix += "*";

  return `${hours}h${minutes > 0 ? ` ${minutes}m` : ""}${suffix}`;
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

  const handleExportDTRForEmployee = async () => {
    if (!selectedEmployee || !selectedMonthForDTR) return;

    const holidayMap = await fetchPhilippineHolidays();

    const logsForMonth = dailyLogs.filter(log => {
      return dayjs(log.date).format("MMMM YYYY") === selectedMonthForDTR;
    });

    const employee = employees.find(e => e.id === selectedEmployee);
    if (!employee) return;

    const wrapper = document.createElement("div");

    const html = generateDTRHtmlForAdmin(
      `${employee.firstName} ${employee.surname}`,
      "POSITION HERE",
      "OFFICE HERE",
      logsForMonth,
      selectedMonthForDTR,
      holidayMap
    );

    const div = document.createElement("div");
    div.innerHTML = html;
    wrapper.appendChild(div);

    const style = document.createElement("style");
    style.innerHTML = dtrStyles;
    wrapper.prepend(style);

    html2pdf()
      .set({ filename: `DTR_${employee.firstName}_${selectedMonthForDTR}.pdf`, html2canvas: { scale: 2 } })
      .from(wrapper)
      .save();
  };

  const calculateUndertime = (entry: DailyLog): string => {
  const expectedMinutes = 8 * 60;

  const parseMinutes = (time: string | undefined): number => {
    if (!time) return 0;
    const [timePart, period] = time.split(" ");
    const [hours, minutes] = timePart.split(":").map(Number);
    let h = hours;
    if (period === "PM" && h < 12) h += 12;
    if (period === "AM" && h === 12) h = 0;
    return h * 60 + minutes;
  };

  if (!entry.clockIn || !entry.clockOut) return "-";

  const rawClockIn = parseMinutes(entry.clockIn);
  const rawClockOut = parseMinutes(entry.clockOut);

  // 🛑 Edge case: identical time
  if (rawClockIn === rawClockOut) return "No Working Hours";

  const start = Math.max(rawClockIn, 8 * 60);
  let end = rawClockOut;

  if (end >= 17 * 60 && end <= 20 * 60) end = 17 * 60;

  // Deduct break
  if (entry.breakOut && entry.breakIn) {
    const bOut = parseMinutes(entry.breakOut);
    const bIn = parseMinutes(entry.breakIn);
    if (bOut && bIn && bIn > bOut) {
      end -= (bIn - bOut);
    }
  }

  const total = end - start;
  const diff = expectedMinutes - total;

  if (diff <= 0) return "-";

  const hrs = Math.floor(diff / 60);
  const mins = diff % 60;
  return `${hrs > 0 ? `${hrs}h ` : ""}${mins}m`;
};



  const generateDTRHtmlForAdmin = (
  name: string,
  position: string,
  office: string,
  logs: DailyLog[],
  month: string,
  holidayMap: Record<string, string>
): string => {
  const logMap: Record<string, DailyLog> = {};
  logs.forEach(log => {
    const day = dayjs(log.date).date();
    logMap[day] = log;
  });

  const [monthName, yearStr] = month.split(" ");
  const monthIndex = new Date(`${monthName} 1, ${yearStr}`).getMonth();
  const year = parseInt(yearStr, 10);
  const daysInMonth = new Date(year, monthIndex + 1, 0).getDate();
  
  // Get current date for comparison
  const currentDate = new Date();
  const currentYear = currentDate.getFullYear();
  const currentMonth = currentDate.getMonth();
  const currentDay = currentDate.getDate();

  const rows = Array.from({ length: daysInMonth }, (_, i) => {
    const day = i + 1;
    const dateObj = new Date(year, monthIndex, day);
    const dateStr = dayjs(dateObj).format("YYYY-MM-DD");
    const readableDate = dayjs(dateObj).format("MMMM DD");

    const log = logMap[day];
    const isSunday = dateObj.getDay() === 0;
    const isHoliday = holidayMap[dateStr];
    
    // Check if date is in the future
    const isFutureDate = 
      year > currentYear ||
      (year === currentYear && monthIndex > currentMonth) ||
      (year === currentYear && monthIndex === currentMonth && day > currentDay);

    const rowStyle = isHoliday
      ? 'style="background-color: #ffdede;"'
      : isSunday
        ? 'style="background-color: #f0f0f0;"'
        : log ? '' : 'style="background-color: #fff8dc;"';

    // Modified notes logic
    const notes = isHoliday
      ? holidayMap[dateStr]
      : isSunday
        ? "Sunday"
        : isFutureDate
          ? "" // Leave blank for future dates
          : log
            ? ""
            : "Absent"; // Only mark as absent if it's a past date with no log

    const undertime = log ? calculateUndertime(log) : "-";

    return `
    <tr ${rowStyle}>
      <td>${readableDate}</td>
      <td>${log?.clockIn || "-"}</td>
      <td>${log?.breakOut || "-"}</td>
      <td>${log?.breakIn || "-"}</td>
      <td>${log?.clockOut || "-"}</td>
      <td>${notes || undertime}</td>
    </tr>`;
  }).join("");

    return `
    <div class="DTR">
    <div class="Civil">
      <span>Civil Service Form No. 48</span>
      <span>1-136</span>
    </div>

    <div class="Daily">
      <span class="Bold">DAILY TIME RECORD</span>
      <div class="Daily-inner">
        <span class="Bold Name">${name}</span>
        <span>${position}</span>
        <span>${office}</span>
      </div>
    </div>

    <div class="Month">
      <span>For the Month of: ${month}</span>
      <div class="Month-inner">
        <span>Official Hours of:</span>
        <span>Regular Days:</span>
        <span>Arrival and Departure:</span>
        <span>Saturdays:</span>
      </div>
    </div>

    <div class="Table">
      <span class="Bold">PERMANENT</span>
      <table border="1" cellpadding="4" cellspacing="0">
        <thead>
          <tr>
            <th rowspan="2">Date</th>
            <th colspan="2">AM</th>
            <th colspan="2">PM</th>
            <th rowspan="2">UNDERTIME</th>
          </tr>
          <tr>
            <th>ARRIVAL</th>
            <th>DEPARTURE</th>
            <th>ARRIVAL</th>
            <th>DEPARTURE</th>
          </tr>
        </thead>
        <tbody>${rows}</tbody>
      </table>
    </div>

    <div class="Certify">
      <span>I Certify on my honor that the above is a true and correct report of the hours work performed, record, of which was daily at the time of arrival and departure from office.</span>
      <span class="Signature"></span>
      <span>Reviewed by:</span>
      <span class="Signature"></span>
      <span class="Bold">Immediate Supervisor/Grade Leader/ Department Head</span>
    </div>

    <div class="Verified">
      <span>VERIFIED as to the prescribed office hours</span>
      <div class="Verified-inner">
        <span class="Bold">DR. ELEONORA C. CAYABYAB</span>
        <span class="Bold">Chief - Curriculum Implementation Division</span>
      </div>
    </div>
  </div>`;
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
        <div style={{ display: "flex", gap: "10px", margin: "1rem 0" }}>
          <select
            value={selectedMonthForDTR}
            onChange={(e) => setSelectedMonthForDTR(e.target.value)}
          >
            <option value="">Select Month</option>
            {[...new Set(dailyLogs.map(log =>
              dayjs(log.date).format("MMMM YYYY")
            ))].map(month => (
              <option key={month} value={month}>{month}</option>
            ))}
          </select>

        </div>

      </div>



      <div className={styles.List_inner}>
        <div className={styles.List_buttons}>
          <select value={filter} onChange={(e) => setFilter(e.target.value)}>
            <option value="all">All</option>
            <option value="week">This Week</option>
            <option value="month">This Month</option>
          </select>
          {/* <button onClick={handleGenerateReport}>Generate Report</button> */}
          <button
            onClick={handleExportDTRForEmployee}
            disabled={!selectedMonthForDTR}
          >
            Export DTR PDF
          </button>
        </div>

        <table>
          <thead>
            <tr>
              <th>Date</th>
              <th>Clock In</th>
              <th>Clock Out</th>
              <th>Working Hours</th>
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
                <td>{day.workingHours}</td>
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