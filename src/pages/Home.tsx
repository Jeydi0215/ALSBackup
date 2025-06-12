import { useEffect, useState } from "react";
import { signOut } from "firebase/auth";
import { auth, db } from "../firebase";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

import styles from "../css/Home.module.css";
import Nav from "../components/Nav";
import Monitoring from "../components/Monitoring";
import Dashboard from "../components/Dashboard";
import History from "../components/History";
import Profile from "../components/Profile";
import Calendar from "../components/Calendar";
import About from "../components/About";
import ClockModal from "../components/ClockModal";
// import EmployeeList from '../components/EmployeeList'
import {
  doc,
  updateDoc,
  collection,
  query,
  where,
  orderBy,
  onSnapshot,
  Timestamp,
  serverTimestamp,
  addDoc,
  GeoPoint,
} from "firebase/firestore";

type Props = {
  handleLogoutClick: () => void;
  isLogout: boolean;
  pageNumber: number;
  handlePageClick: (value: number) => void;
};

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
  location?: {
    latitude: number;
    longitude: number;
    address?: string;
  };
  isOffline?: boolean; // Flag to indicate if this was created offline
}

interface OfflineClockEntry {
  id: string;
  uid: string;
  key: string;
  timeString: string;
  date: string;
  imageUrl: string;
  userFirstName: string;
  userSurname: string;
  location?: {
    latitude: number;
    longitude: number;
    address?: string;
  };
  timestamp: number; // Unix timestamp for sorting
}

const Home = ({
  handleLogoutClick,
  isLogout,
  pageNumber,
  handlePageClick,
}: Props) => {
  const [selectedEmployeeId, setSelectedEmployeeId] = useState<string | null>(
    null
  );
  const handlePageAndEmployeeClick = (pageNum: number, employeeId?: string) => {
    setSelectedEmployeeId(employeeId || null);
    handlePageClick(pageNum);
  };
  const [showCamera, setShowCamera] = useState(false);
  const [currentKey, setCurrentKey] = useState<string>("");
  const [clockLog, setClockLog] = useState<ClockLogEntry[]>([]);
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [offlineEntries, setOfflineEntries] = useState<OfflineClockEntry[]>([]);

  const { currentUser } = useAuth();

  // Monitor online/offline status
  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      syncOfflineData();
    };

    const handleOffline = () => {
      setIsOnline(false);
    };

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);

    // Load offline entries on component mount
    loadOfflineEntries();

    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, []);

  // Load offline entries from localStorage
  const loadOfflineEntries = () => {
    if (!currentUser) return;

    try {
      const stored = localStorage.getItem(
        `offline_clock_entries_${currentUser.uid}`
      );
      if (stored) {
        const entries: OfflineClockEntry[] = JSON.parse(stored);
        setOfflineEntries(entries);

        // Add offline entries to clock log for display
        const offlineClockEntries: ClockLogEntry[] = entries.map((entry) => ({
          id: entry.id,
          uid: entry.uid,
          key: entry.key,
          timeString: entry.timeString,
          date: entry.date,
          imageUrl: entry.imageUrl,
          status: "Pending (Offline)",
          isOffline: true,
          location: entry.location,
        }));

        setClockLog((prevLog) => [...offlineClockEntries, ...prevLog]);
      }
    } catch (error) {
      console.error("Error loading offline entries:", error);
    }
  };

  // Save offline entry to localStorage
  const saveOfflineEntry = (entry: OfflineClockEntry) => {
    if (!currentUser) return;

    try {
      const key = `offline_clock_entries_${currentUser.uid}`;
      const existing = localStorage.getItem(key);
      const entries: OfflineClockEntry[] = existing ? JSON.parse(existing) : [];

      entries.push(entry);
      localStorage.setItem(key, JSON.stringify(entries));
      setOfflineEntries(entries);

      // Add to clock log for immediate display
      const displayEntry: ClockLogEntry = {
        id: entry.id,
        uid: entry.uid,
        key: entry.key,
        timeString: entry.timeString,
        date: entry.date,
        imageUrl: entry.imageUrl,
        status: "Pending (Offline)",
        isOffline: true,
        location: entry.location,
      };

      setClockLog((prevLog) => [displayEntry, ...prevLog]);
    } catch (error) {
      console.error("Error saving offline entry:", error);
    }
  };

  // Sync offline data to Firebase when online
  const syncOfflineData = async () => {
    if (!currentUser || offlineEntries.length === 0) return;

    try {
      console.log(`Syncing ${offlineEntries.length} offline entries...`);

      for (const entry of offlineEntries) {
        const manilaTime = new Date(entry.timestamp);

        await addDoc(collection(db, "clockLog"), {
          uid: entry.uid,
          key: entry.key,
          time: Timestamp.fromDate(manilaTime),
          timeString: entry.timeString,
          date: entry.date,
          imageUrl: entry.imageUrl,
          status: "pending",
          userFirstName: entry.userFirstName,
          userSurname: entry.userSurname,
          location: entry.location
            ? {
                coordinates: new GeoPoint(
                  entry.location.latitude,
                  entry.location.longitude
                ),
                address: entry.location.address,
                timestamp: serverTimestamp(),
              }
            : null,
          syncedFromOffline: true, // Flag to indicate this was synced from offline
        });
      }

      // Clear offline entries after successful sync
      localStorage.removeItem(`offline_clock_entries_${currentUser.uid}`);
      setOfflineEntries([]);

      // Remove offline entries from display (they'll be replaced by Firebase data)
      setClockLog((prevLog) => prevLog.filter((entry) => !entry.isOffline));

      console.log("Offline data synced successfully!");

      // Optional: Show success notification
      // You can add a toast notification here
    } catch (error) {
      console.error("Error syncing offline data:", error);
      // Optional: Show error notification
    }
  };

  const handleCameraClick = (key: string) => {
    setCurrentKey(key);
    setShowCamera((prev) => !prev);
  };

  const handleClockLogSubmit = async (
    image: string,
    formattedTimestamp: string,
    imageUrl?: string,
    location?: {
      latitude: number;
      longitude: number;
      address?: string;
    }
  ) => {
    if (!currentUser || !currentKey) return;

    const now = new Date();
    const manilaTime = new Date(
      now.toLocaleString("en-US", { timeZone: "Asia/Manila" })
    );

    // If offline, save to localStorage
    if (!isOnline) {
      const offlineEntry: OfflineClockEntry = {
        id: `offline_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        uid: currentUser.uid,
        key: currentKey,
        timeString: manilaTime.toLocaleTimeString("en-US", {
          hour: "2-digit",
          minute: "2-digit",
          hour12: true,
        }),
        date: manilaTime.toLocaleDateString("en-US", {
          month: "long",
          day: "2-digit",
          year: "numeric",
        }),
        imageUrl: imageUrl || "",
        userFirstName: currentUser.userFirstName,
        userSurname: currentUser.userSurname,
        location,
        timestamp: manilaTime.getTime(),
      };

      saveOfflineEntry(offlineEntry);
      setShowCamera(false);
      return;
    }

    // Online - save directly to Firebase
    try {
      await addDoc(collection(db, "clockLog"), {
        uid: currentUser.uid,
        key: currentKey,
        time: serverTimestamp(),
        timeString: manilaTime.toLocaleTimeString("en-US", {
          hour: "2-digit",
          minute: "2-digit",
          hour12: true,
        }),
        date: manilaTime.toLocaleDateString("en-US", {
          month: "long",
          day: "2-digit",
          year: "numeric",
        }),
        imageUrl,
        status: "pending",
        userFirstName: currentUser.userFirstName,
        userSurname: currentUser.userSurname,
        location: location
          ? {
              coordinates: new GeoPoint(location.latitude, location.longitude),
              address: location.address,
              timestamp: serverTimestamp(),
            }
          : null,
      });
    } catch (error) {
      console.error("Error saving clock log:", error);

      // If Firebase save fails, save offline as fallback
      const offlineEntry: OfflineClockEntry = {
        id: `fallback_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        uid: currentUser.uid,
        key: currentKey,
        timeString: manilaTime.toLocaleTimeString("en-US", {
          hour: "2-digit",
          minute: "2-digit",
          hour12: true,
        }),
        date: manilaTime.toLocaleDateString("en-US", {
          month: "long",
          day: "2-digit",
          year: "numeric",
        }),
        imageUrl: imageUrl || "",
        userFirstName: currentUser.userFirstName,
        userSurname: currentUser.userSurname,
        location,
        timestamp: manilaTime.getTime(),
      };

      saveOfflineEntry(offlineEntry);
    } finally {
      setShowCamera(false);
    }
  };

  const renderPage = () => {
    switch (pageNumber) {
      case 1:
        return (
          <Dashboard
            handleCameraClick={handleCameraClick}
            showCamera={showCamera}
            clockLog={clockLog}
          />
        );
      case 2:
        return <History />;
      case 3:
        return <Profile userId={selectedEmployeeId} />;
      case 4:
        return <About />;
      case 5:
        return <Monitoring handlePageClick={handlePageAndEmployeeClick} />;
      case 6:
        return <Calendar />;
      default:
        return <History />;
    }
  };

  const navigate = useNavigate();
  const handleFirebaseLogout = async () => {
    try {
      if (currentUser) {
        const userDocRef = doc(db, "users", currentUser.uid);

        // Set status to offline explicitly on logout
        await updateDoc(userDocRef, {
          status: "offline",
        });
      }
      await signOut(auth);
      navigate("/");
      handleLogoutClick();
    } catch (error: unknown) {
      if (error instanceof Error) {
        console.error("Error logging out: ", error.message);
      } else {
        console.error("An unknown error occurred during logout.");
      }
    }
  };

  // Firebase clock log listener
  useEffect(() => {
    if (!currentUser) return;

    const q = query(
      collection(db, "clockLog"),
      where("uid", "==", currentUser.uid),
      orderBy("time", "desc")
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const logs = snapshot.docs.map((doc) => ({
        id: doc.id,
        uid: doc.data().uid,
        key: doc.data().key,
        time: doc.data().time,
        timeString: doc.data().timeString,
        date: doc.data().date,
        imageUrl: doc.data().imageUrl || null,
        image: doc.data().image || null,
        status: doc.data().status || "Pending",
        location: doc.data().location,
        isOffline: false,
      })) as ClockLogEntry[];

      // Combine Firebase logs with offline entries
      const offlineClockEntries: ClockLogEntry[] = offlineEntries.map(
        (entry) => ({
          id: entry.id,
          uid: entry.uid,
          key: entry.key,
          timeString: entry.timeString,
          date: entry.date,
          imageUrl: entry.imageUrl,
          status: "Pending (Offline)",
          isOffline: true,
          location: entry.location,
        })
      );

      setClockLog([...offlineClockEntries, ...logs]);
    });

    return () => unsubscribe();
  }, [currentUser, offlineEntries]);

  return (
    <div className={styles.Home}>
      {/* Optional: Connection status indicator */}
      {!isOnline && (
        <div
          style={{
            position: "fixed",
            top: 0,
            left: 0,
            right: 0,
            backgroundColor: "#ff6b6b",
            color: "white",
            padding: "8px",
            textAlign: "center",
            zIndex: 1000,
            fontSize: "14px",
          }}
        >
          You are currently offline. Clock entries will be saved locally and
          synced when connection is restored.
          {offlineEntries.length > 0 &&
            ` (${offlineEntries.length} entries pending sync)`}
        </div>
      )}

      <Nav
        handleLogoutClick={handleLogoutClick}
        handlePageClick={handlePageClick}
        pageNumber={pageNumber}
        currentUser={currentUser}
      />

      <ClockModal
        handleCameraClick={handleCameraClick}
        showCamera={showCamera}
        onSubmitClockLog={handleClockLogSubmit}
      />

      <div className={styles.Render}>{renderPage()}</div>

      {isLogout && (
        <div className={styles.Logout_main}>
          <div className={styles.Logout}>
            <span>Log Out from Your DTR Account?</span>
            <span>
              Make sure you've clocked in or out properly before logging out.
              Unsaved time entries might not be recorded.
              {offlineEntries.length > 0 &&
                ` You have ${offlineEntries.length} offline entries that will be synced when you're back online.`}
            </span>
            <div className={styles.Logout_inner}>
              <button onClick={handleFirebaseLogout}>Logout</button>
              <button onClick={handleLogoutClick}>Cancel</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Home;
