import React, { useEffect, useState } from "react";
import styles from "../css/Dashboard.module.css"; 
import { useAuth } from "../context/AuthContext";
import {
  collection,
  query,
  where,
  orderBy,
  onSnapshot,
  Timestamp
} from "firebase/firestore";
import { db } from "../firebase";

interface ClockLogEntry {
  imageUrl: string;
  id: string;
  uid: string;
  key: string;
  time?: Timestamp;
  timeString: string;
  date: string;
}

const LastWeekLog = () => {
  const { currentUser } = useAuth();
  const [clockLog, setClockLog] = useState<ClockLogEntry[]>([]);
  const [lastWeekData, setLastWeekData] = useState<any[]>([]);

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
    });

    return () => unsubscribe();
  }, [currentUser]);

  useEffect(() => {
    if (clockLog.length === 0) return;

    const now = new Date();
    const currentDay = now.getDay(); // 0 = Sunday
    const startOfLastWeek = new Date(now);
    const endOfLastWeek = new Date(now);

    // Go back to last Sunday (start of last week)
    startOfLastWeek.setDate(now.getDate() - currentDay - 7);
    startOfLastWeek.setHours(0, 0, 0, 0);

    // End of last Saturday
    endOfLastWeek.setDate(now.getDate() - currentDay - 1);
    endOfLastWeek.setHours(23, 59, 59, 999);

    const grouped: Record<string, any> = {};

    clockLog.forEach(log => {
      if (!log.time || !log.key || !log.timeString) return;

      const logDateObj = log.time instanceof Timestamp ? log.time.toDate() : new Date(log.time);

      if (logDateObj < startOfLastWeek || logDateObj > endOfLastWeek) return;

      const logDateStr = logDateObj.toLocaleDateString("en-US", {
        month: "long",
        day: "2-digit",
        year: "numeric"
      });

      if (!grouped[logDateStr]) {
        grouped[logDateStr] = {
          date: logDateStr,
          image: null,
          clockIn: "",
          breakIn: "",
          breakOut: "",
          clockOut: "",
          workingHours: ""
        };
      }

      if (["clockIn", "breakIn", "breakOut", "clockOut"].includes(log.key)) {
        if (!grouped[logDateStr][log.key]) {
          grouped[logDateStr][log.key] = log.timeString;
          if (log.key === "clockIn" && log.imageUrl) {
            grouped[logDateStr].image = log.imageUrl;
          }
        }
      }
    });

    const calculateWorkingHours = (
      clockInTime: string,
      breakInTime: string,
      breakOutTime: string,
      clockOutTime: string
    ) => {
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

    Object.values(grouped).forEach((day: any) => {
      day.workingHours = calculateWorkingHours(
        day.clockIn,
        day.breakIn,
        day.breakOut,
        day.clockOut
      );
    });

    setLastWeekData(
      Object.values(grouped).sort((a: any, b: any) =>
        new Date(b.date).getTime() - new Date(a.date).getTime()
      )
    );
  }, [clockLog]);

  return (
    <div className={styles.Weekly}>
      <h2>Last Week's Clock Logs</h2>

      {lastWeekData.length > 0 ? (
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
              {lastWeekData.map((day, index) => (
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
                    ) : "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <p>No logs found for last week.</p>
      )}
    </div>
  );
};

export default LastWeekLog;
