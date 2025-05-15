import { useEffect, useState } from 'react';
import { db } from '../firebase';
import { collection, onSnapshot, query, orderBy, getDoc, doc, where, Timestamp } from 'firebase/firestore';
import styles from '../css/Monitoring.module.css';
import In from './In';
import Out from './Out';
import Break from './Break';
import OffBreak from './OffBreak';
import { useAuth } from '../context/AuthContext';

interface User {
  uid: string;
  firstName: string;
  surname: string;
}

interface ClockLogEntry {
  uid: string;
  key: string;
  time: string | Timestamp; // Can be either string or Firebase Timestamp
}

const EmployeeTracker = () => {
  const { currentUser } = useAuth();
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(true);
  const [allUsers, setAllUsers] = useState<User[]>([]);
  const [allLogs, setAllLogs] = useState<ClockLogEntry[]>([]);

  useEffect(() => {
    const checkAdminStatus = async () => {
      if (!currentUser) return;

      try {
        const userDoc = await getDoc(doc(db, "users", currentUser.uid));
        setIsAdmin(userDoc.data()?.admin || false);
      } catch (error) {
        console.error("Error checking admin status:", error);
      } finally {
        setLoading(false);
      }
    };

    checkAdminStatus();
  }, [currentUser]);

  // Format timestamp for display
  const formatTimestamp = (timestamp: string | Timestamp): string => {
    if (!timestamp) return "N/A";

    if (typeof timestamp === 'string') {
      return timestamp;
    }

    try {
      // If it's a Firebase Timestamp
      if (timestamp instanceof Timestamp) {
        return timestamp.toDate().toLocaleString();
      }

      // If it's a Timestamp object but not an instance (can happen with Firestore data)
      if (timestamp.seconds && timestamp.nanoseconds) {
        return new Date(timestamp.seconds * 1000).toLocaleString();
      }

      return "N/A";
    } catch (error) {
      console.error("Error formatting timestamp:", error);
      return "Invalid date";
    }
  };

  // Fetch data based on admin status
  useEffect(() => {
    if (loading || !currentUser) return;

    let unsubUsers: () => void;
    let unsubLogs: () => void;

    const fetchData = () => {
      // Always fetch users (assuming your rules allow this)
      unsubUsers = onSnapshot(collection(db, "users"),
        (userSnap) => {
          const users = userSnap.docs.map((doc) => ({
            uid: doc.id,
            firstName: doc.data().firstName,
            surname: doc.data().surname,
          }));
          setAllUsers(users);
        },
        (error) => {
          console.error("Error fetching users:", error);
        }
      );

      // Only fetch all logs if admin
      if (isAdmin) {
        unsubLogs = onSnapshot(
          query(collection(db, "clockLog"), orderBy("time", "desc")),
          (logSnap) => {
            const logs = logSnap.docs.map((doc) => doc.data() as ClockLogEntry);
            setAllLogs(logs);
          },
          (error) => {
            console.error("Error fetching logs:", error);
          }
        );
      } else {
        // For non-admins, only fetch their own logs
        unsubLogs = onSnapshot(
          query(
            collection(db, "clockLog"),
            where("uid", "==", currentUser.uid),
            orderBy("time", "desc")
          ),
          (logSnap) => {
            const logs = logSnap.docs.map((doc) => doc.data() as ClockLogEntry);
            setAllLogs(logs);
          },
          (error) => {
            console.error("Error fetching user logs:", error);
          }
        );
      }
    };

    fetchData();

    return () => {
      unsubUsers?.();
      unsubLogs?.();
    };
  }, [currentUser, isAdmin, loading]);

  // Helper function to get the latest log of a user
  const getUserStatus = (uid: string) => {
    const userLogs = allLogs.filter((log) => log.uid === uid);
    const latestLog = userLogs[0]; // Latest log based on orderBy("time", "desc")

    if (!latestLog) return { status: "No logs", timestamp: "" };

    switch (latestLog.key) {
      case "clockIn":
        return { status: "Clocked In", timestamp: formatTimestamp(latestLog.time) };
      case "breakIn":
        return { status: "On Break", timestamp: formatTimestamp(latestLog.time) };
      case "breakOut":
        return { status: "Off Break", timestamp: formatTimestamp(latestLog.time) };
      case "clockOut":
        return { status: "Clocked Out", timestamp: formatTimestamp(latestLog.time) };
      default:
        return { status: "No logs", timestamp: "" };
    }
  };

  if (loading) return <div>Loading user data...</div>;
  if (!currentUser) return <div>Please sign in to view this page</div>;

  return (
    <div className={styles.EmployeeTracker}>
      <h2>Employee Tracker</h2>
      <table>
        <thead>
          <tr>
            <th>Employee Name</th>
            <th>Status</th>
            <th>Timestamp</th>
          </tr>
        </thead>
        <tbody>
          {allUsers.map((user) => {
            const isCurrentAdmin = isAdmin && user.uid === currentUser.uid;

            const { status, timestamp } = getUserStatus(user.uid);

            return (
              <tr key={user.uid}>
                <td>{user.firstName} {user.surname}</td>
                <td>
                  {isCurrentAdmin ? (
                    "Admin"
                  ) : status === "Clocked In" ? (
                    <In />
                  ) : status === "Clocked Out" ? (
                    <Out />
                  ) : status === "On Break" ? (
                    <Break />
                  ) : status === "Off Break" ? (
                    <OffBreak />
                  ) : (
                    "No activity"
                  )}
                </td>
                <td>{isCurrentAdmin ? "—" : timestamp || "N/A"}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
};

export default EmployeeTracker;