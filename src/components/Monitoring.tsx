import { useState, useEffect } from "react";

import styles from "../css/Monitoring.module.css";
import EmployeeTracker from "./EmployeeTracker";
import EmployeeList from "./EmployeeList";
import Pending from "./Pending";
import AddTeacher from "./AddTeacher";

import Logged from "../assets/logged.png";
import Clock from "../assets/clock.png";
import Coffee from "../assets/coffee.png";
import Out from "../assets/logout.png";

import { useMonitoring } from "../context/MonitoringContext";
import { db } from "../firebase";
import {
  collection,
  query,
  where,
  orderBy,
  onSnapshot,
} from "firebase/firestore";
type Props = {
  handlePageClick: (value: number) => void;
};

const Monitoring = ({ handlePageClick }: Props) => {
  const [activeTab, setActiveTab] = useState("list");

  const [statusCounts, setStatusCounts] = useState({
    working: 0,
    onBreak: 0,
    clockedOut: 0,
  });

  const { loggedInCount, totalUsers } = useMonitoring();

  useEffect(() => {
    const today = new Date().toLocaleDateString("en-US", {
      month: "long",
      day: "2-digit",
      year: "numeric",
    });

    const q = query(
      collection(db, "clockLog"),
      where("date", "==", today),
      orderBy("time", "desc")
    );

    const unsubscribe = onSnapshot(q, (querySnapshot) => {
      const employeeStatuses = new Map();

      querySnapshot.forEach((doc) => {
        const log = doc.data();
        if (!employeeStatuses.has(log.uid)) {
          employeeStatuses.set(log.uid, log.key);
        }
      });

      let working = 0;
      let onBreak = 0;
      let clockedOut = 0;

      employeeStatuses.forEach((status) => {
        switch (status) {
          case "clockIn":
            working++;
            break;
          case "breakIn":
            onBreak++;
            break;
          case "breakOut":
            working++;
            break;
          case "clockOut":
            clockedOut++;
            break;
          default:
            break;
        }
      });

      setStatusCounts({
        working,
        onBreak,
        clockedOut,
      });
    });

    return () => unsubscribe();
  }, []);

  const [openAdd, setOpenAdd] = useState(false);
  const handleAddTeacher = () => {
    setOpenAdd(!openAdd);
  };

  return (
    <div className={styles.Monitoring}>
      <span className={styles.Monitoring_title}>Employee Monitoring</span>

      <div className={styles.Widget_container}>
        <div className={styles.Widget}>
          <div className={styles.Widget_inner}>
            <span>Logged In</span>
            <img src={Logged} alt="User icon" />
          </div>
          <span className={styles.Count}>
            {loggedInCount - 1}/{totalUsers}
          </span>
        </div>

        <div className={styles.Widget}>
          <div className={styles.Widget_inner}>
            <span>Working</span>
            <img src={Clock} alt="Clock icon" />
          </div>
          <span className={styles.Count}>
            {statusCounts.working}/{totalUsers}
          </span>
        </div>

        <div className={styles.Widget}>
          <div className={styles.Widget_inner}>
            <span>On Break</span>
            <img src={Coffee} alt="Coffee icon" />
          </div>
          <span className={styles.Count}>
            {statusCounts.onBreak}/{totalUsers}
          </span>
        </div>

        <div className={styles.Widget}>
          <div className={styles.Widget_inner}>
            <span>Clock Out</span>
            <img src={Out} alt="Logout icon" />
          </div>
          <span className={styles.Count}>
            {statusCounts.clockedOut}/{totalUsers}
          </span>
        </div>
      </div>

      <div className={styles.Monitoring_table}>
        <div className={styles.Monitoring_inner}>
          <div className={styles.Monitoring_left}>
            <button
              className={activeTab === "list" ? styles.Active : ""}
              onClick={() => setActiveTab("list")}
            >
              Employee List
            </button>
            <button
              className={activeTab === "tracker" ? styles.Active : ""}
              onClick={() => setActiveTab("tracker")}
            >
              Tracker
            </button>

            <button
              className={activeTab === "approval" ? styles.Active : ""}
              onClick={() => setActiveTab("approval")}
            >
              Approval
            </button>
          </div>
        </div>

        {activeTab === "tracker" && <EmployeeTracker />}
        {activeTab === "list" && (
          <EmployeeList
            handlePageClick={handlePageClick}
            handleAddTeacher={handleAddTeacher}
          />
        )}
        {activeTab === "approval" && <Pending />}
      </div>
      {openAdd && <AddTeacher handleAddTeacher={handleAddTeacher} />}
    </div>
  );
};

export default Monitoring;
