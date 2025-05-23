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

const Summary = () => {
  const { currentUser } = useAuth();
  const [clockLog, setClockLog] = useState<ClockLogEntry[]>([]);
  const [filter, setFilter] = useState<"week" | "month">("week");

  useEffect(() => {
    const fetchLogs = async () => {
      if (!currentUser) return;

      const logsRef = query(
        collection(db, "clockLog"),
        where("uid", "==", currentUser.uid),
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
  }, [currentUser]);

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

    const parseMinutes = (str: string) => {
      const [time, period] = str.split(" ");
      let [h, m] = time.split(":").map(Number);
      if (period === "PM" && h < 12) h += 12;
      if (period === "AM" && h === 12) h = 0;
      return h * 60 + m;
    };

    Object.values(summaryMap).forEach((day: any) => {
      const { clockIn, clockOut, breakIn, breakOut } = day;
      if (clockIn && clockOut) {
        let workMins = parseMinutes(clockOut) - parseMinutes(clockIn);
        if (breakIn && breakOut) {
          workMins -= (parseMinutes(breakOut) - parseMinutes(breakIn));
          day.breakTime = formatMins(parseMinutes(breakOut) - parseMinutes(breakIn));
        } else {
          day.breakTime = "00:00";
        }
        day.workTime = formatMins(workMins);
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
