import { useEffect, useState } from "react";
import * as XLSX from "xlsx";
import styles from "../css/Summary.module.css";
import { useAuth } from "../context/AuthContext";
import {
  collection,
  query,
  where,
  orderBy,
  getDocs,
  Timestamp,
} from "firebase/firestore";
import { db } from "../firebase";

interface ClockLogEntry {
  id: string;
  uid: string;
  key: string;
  time?: Timestamp;
  timeString: string;
  date: string;
}

interface SummaryProps {
  userId?: string; // Add this prop
}

const Summary = ({ userId }: SummaryProps) => {
  const { currentUser } = useAuth();
  const [clockLog, setClockLog] = useState<ClockLogEntry[]>([]);
  const [filter, setFilter] = useState<"week" | "month">("week");

  useEffect(() => {
    const fetchLogs = async () => {
      const targetUserId = userId || currentUser?.uid;
      if (!targetUserId) return;

      const logsRef = query(
        collection(db, "clockLog"),
        where("uid", "==", targetUserId),
        orderBy("time", "desc")
      );

      const snapshot = await getDocs(logsRef);
      const logs = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as ClockLogEntry[];

      setClockLog(logs);
    };

    fetchLogs();
  }, [currentUser, userId]);

  const getFilteredLogs = () => {
    const now = new Date();
    const startDate = new Date(now);

    if (filter === "week") {
      startDate.setDate(now.getDate() - 6);
    } else {
      startDate.setMonth(now.getMonth() - 1);
    }

    const filtered = clockLog.filter(log => {
      const logDate = log.time instanceof Timestamp ? log.time.toDate() : new Date(log.time!);
      return logDate >= startDate && logDate <= now;
    });

    // Group by date and assemble a daily summary
    const summaryMap: Record<string, any> = {};

    filtered.forEach(log => {
      const logDate = log.time instanceof Timestamp ? log.time.toDate() : new Date(log.time!);
      const dateStr = logDate.toLocaleDateString("en-US", {
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
      });

      if (!summaryMap[dateStr]) {
        summaryMap[dateStr] = {
          date: dateStr,
          clockIn: "",
          clockOut: "",
          breakIn: "",
          breakOut: "",
          workTime: "",
          breakTime: ""
        };
      }

      if (["clockIn", "clockOut", "breakIn", "breakOut"].includes(log.key)) {
        summaryMap[dateStr][log.key] = log.timeString;
      }
    });


    const parseTimeStringToDate = (timeStr: string, dateStr: string) => {
      const [time, period] = timeStr.split(" ");
      let [h, m] = time.split(":").map(Number);
      if (period === "PM" && h < 12) h += 12;
      if (period === "AM" && h === 12) h = 0;

      const [month, day, year] = dateStr.split("/");
      const date = new Date(`${year}-${month}-${day}T${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:00`);
      return date;
    };


    Object.values(summaryMap).forEach((day: any) => {
      const { clockIn, clockOut, breakIn, breakOut, date } = day;

      let adjustedClockIn = null;
      let adjustedClockOut = null;

      if (clockIn) {
        const clockInDate = parseTimeStringToDate(clockIn, date);
        const eightAM = new Date(clockInDate);
        eightAM.setHours(8, 0, 0, 0);
        adjustedClockIn = clockInDate < eightAM ? eightAM : clockInDate;
      }

      if (clockOut) {
        const clockOutDate = parseTimeStringToDate(clockOut, date);
        const fivePM = new Date(clockOutDate);
        fivePM.setHours(17, 0, 0, 0);

        const eightPM = new Date(clockOutDate);
        eightPM.setHours(20, 0, 0, 0);

        // If after 8PM, discard the day
        if (clockOutDate >= eightPM) {
          adjustedClockIn = null;
          adjustedClockOut = null;
        } else if (clockOutDate >= fivePM) {
          adjustedClockOut = fivePM;
        } else {
          adjustedClockOut = clockOutDate;
        }
      }

      if (adjustedClockIn && adjustedClockOut) {
        let workMins = (adjustedClockOut.getTime() - adjustedClockIn.getTime()) / 60000;

        if (breakIn && breakOut) {
          const breakStart = parseTimeStringToDate(breakIn, date);
          const breakEnd = parseTimeStringToDate(breakOut, date);
          const breakMins = (breakEnd.getTime() - breakStart.getTime()) / 60000;
          workMins -= breakMins;
          day.breakTime = formatMins(breakMins);
        } else {
          day.breakTime = "00:00";
        }

        day.workTime = formatMins(Math.max(workMins, 0));
      } else {
        day.workTime = "00:00";
        day.breakTime = "00:00";
      }
    });


    return Object.values(summaryMap)
      .sort((a: any, b: any) => new Date(b.date).getTime() - new Date(a.date).getTime())
      .slice(0, 5); // latest 5
  };

  const formatMins = (mins: number) => {
    const h = Math.floor(mins / 60);
    const m = mins % 60;
    return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
  };

  const handleExport = () => {
    const data = getFilteredLogs();
    const worksheet = XLSX.utils.json_to_sheet(data.map(row => ({
      Date: row.date,
      "Clock In": row.clockIn,
      "Clock Out": row.clockOut,
      "Break Time": row.breakTime,
      "Work Time": row.workTime
    })));

    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Summary");
    XLSX.writeFile(workbook, "summary.xlsx");
  };

  const summary = getFilteredLogs();

  return (
    <div className={styles.Summary}>
      <div className={styles.Summary_top}>
        <select
          value={filter}
          onChange={(e) => setFilter(e.target.value as "week" | "month")}
        >
          <option value="week">This Week</option>
          <option value="month">This Month</option>
        </select>

        <button onClick={handleExport}>Export</button>
      </div>

      <table>
        <thead>
          <tr>
            <th>Date</th>
            <th>Clock In</th>
            <th>Clock Out</th>
            <th>Break Time</th>
            <th>Work Time</th>
          </tr>
        </thead>
        <tbody>
          {summary.map((row, idx) => (
            <tr key={idx}>
              <td>{row.date}</td>
              <td>{row.clockIn}</td>
              <td>{row.clockOut}</td>
              <td>{row.breakTime}</td>
              <td>{row.workTime}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

export default Summary;
