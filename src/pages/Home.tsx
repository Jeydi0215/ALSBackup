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
import About from "../components/About";
import ClockModal from "../components/ClockModal";
import EmployeeList from '../components/EmployeeList'
import { doc, updateDoc, collection, query, where, orderBy, onSnapshot, Timestamp, serverTimestamp, addDoc, GeoPoint } from "firebase/firestore";



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
}

const Home = ({
  handleLogoutClick,
  isLogout,
  pageNumber,
  handlePageClick,
}: Props) => {
  const [showCamera, setShowCamera] = useState(false);
  const [currentKey, setCurrentKey] = useState<string>("");
  const [clockLog, setClockLog] = useState<ClockLogEntry[]>([]);

  const handleCameraClick = (key: string) => {
    setCurrentKey(key);
    setShowCamera((prev) => !prev);
  };

  const handleClockLogSubmit = async (
  image: string,              // First parameter matches what ClockModal sends
  formattedTimestamp: string, // Second parameter
  imageUrl?: string,          // Third parameter
  location?: {               // Fourth parameter
    latitude: number;
    longitude: number;
    address?: string;
  }
) => {
  if (!currentUser || !currentKey) return;

  // Get current Manila time
  const now = new Date();
  const manilaTime = new Date(now.toLocaleString("en-US", { timeZone: "Asia/Manila" }));
  
  // // For clock-ins only: apply special rules
  // if (currentKey === "clockIn") {
  //   // 1. No clock-ins after 3:00 PM
  //   if (manilaTime.getHours() >= 15) {
  //     alert("Clock-in is only allowed before 3:00 PM");
  //     setShowCamera(false);
  //     return;
  //   }

  //   // 2. Early clock-in adjustment (before 8:00 AM becomes 8:00 AM)
  //   const isEarlyClockIn = manilaTime.getHours() < 8;
  //   const actualTime = manilaTime.toLocaleTimeString("en-US", {
  //     hour: "2-digit",
  //     minute: "2-digit",
  //     hour12: true
  //   });
  //   const adjustedTime = isEarlyClockIn 
  //     ? new Date(manilaTime.setHours(8, 0, 0, 0))
  //     : manilaTime;

  //   try {
  //     await addDoc(collection(db, "clockLog"), {
  //       uid: currentUser.uid,
  //       key: currentKey,
  //       actualTime: actualTime, // e.g. "7:30 AM"
  //       adjustedTime: adjustedTime.toLocaleTimeString("en-US", {
  //         hour: "2-digit",
  //         minute: "2-digit",
  //         hour12: true
  //       }), // e.g. "8:00 AM"
  //       time: Timestamp.fromDate(adjustedTime), // Use adjusted for sorting
  //       timeString: `${actualTime} → 8:00 AM`, // Visual indicator
  //       date: manilaTime.toLocaleDateString("en-US", {
  //         month: "long",
  //         day: "2-digit",
  //         year: "numeric",
  //       }),
  //       imageUrl,
  //       status: "pending",
  //       userFirstName: currentUser.userFirstName,
  //       userSurname: currentUser.userSurname,
  //       isAdjusted: isEarlyClockIn // Flag for adjusted clock-ins
  //     });
  //   } catch (error) {
  //     console.error("Error saving clock log:", error);
  //   } finally {
  //     setShowCamera(false);
  //   }
  //   return;
  // }

  // Original logic for other types (breakIn, breakOut, clockOut)
  try {
    await addDoc(collection(db, "clockLog"), {
      uid: currentUser.uid,
      key: currentKey,
      time: serverTimestamp(),
      timeString: manilaTime.toLocaleTimeString("en-US", {
        hour: "2-digit",
        minute: "2-digit",
        hour12: true
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
     location: location ? {
    coordinates: new GeoPoint(location.latitude, location.longitude),
    address: location.address,
    timestamp: serverTimestamp()
  } : null
});
  } catch (error) {
    console.error("Error saving clock log:", error);
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
        return <Profile />;
      case 4:
        return <About />;
      case 5:
          return <Monitoring />;
      case 6:
          return <EmployeeList />;
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
      if (error instanceof Error){
        console.error("Error logging out: ", error.message);
      } else{
        console.error("An unknown error occurred during logout.");
      }
    }
  };
  
  const { currentUser } = useAuth();
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
    })) as ClockLogEntry[];
    setClockLog(logs);
  });

  return () => unsubscribe();
}, [currentUser]);


  return (
    <div className={styles.Home}>
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
              Make sure you’ve clocked in or out properly before logging out.
              Unsaved time entries might not be recorded.
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