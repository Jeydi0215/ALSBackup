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
import { doc, updateDoc, collection, query, where, orderBy, onSnapshot, Timestamp, serverTimestamp, addDoc } from "firebase/firestore";


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

  const handleClockLogSubmit = async (imageUrl?: string) => {
    if (!currentUser || !currentKey) return;

    const now = new Date();
    const timeString = now.toLocaleTimeString("en-US", {
      hour: "2-digit",
      minute: "2-digit",
      hour12: true,
      timeZone: "Asia/Manila"
    });
    try {
      await addDoc(collection(db, "clockLog"), {
        uid: currentUser.uid,
        key: currentKey,
        time: serverTimestamp(),
        timeString,
        date: now.toLocaleDateString("en-US", {
          month: "long",
          day: "2-digit",
          year: "numeric",
        }),
        imageUrl: imageUrl // Store the Firebase Storage URL
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
      image: doc.data().image || null
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