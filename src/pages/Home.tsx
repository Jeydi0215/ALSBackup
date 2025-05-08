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
import { doc, updateDoc } from "firebase/firestore";


type Props = {
  handleLogoutClick: () => void;
  isLogout: boolean;
  pageNumber: number;
  handlePageClick: (value: number) => void;
};

const Home = ({
  handleLogoutClick,
  isLogout,
  pageNumber,
  handlePageClick,
}: Props) => {
  const renderPage = () => {
    switch (pageNumber) {
      case 1:
        return (
          <Dashboard
            handleCameraClick={handleCameraClick}
            showCamera={showCamera}
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

  const [showCamera, setShowCamera] = useState(false);
  const handleCameraClick = () => {
    setShowCamera(!showCamera);
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
    if (!currentUser) {
      navigate("/"); // Redirect to login page if not logged in
    }
  }, [currentUser, navigate]);

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
      />

      <div className={styles.Render}>
      {renderPage()}
      </div>

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
