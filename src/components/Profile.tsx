import { useState, useEffect } from "react";
import { useAuth } from "../context/AuthContext";
import { doc, getDoc, updateDoc } from "firebase/firestore";
import { db } from "../firebase";

import styles from "../css/Profile.module.css";
import Avatar from "../assets/avatar.png";
import Edit from "../assets/Edit.png";
import User from "../assets/user.png";
import Gender from "../assets/gender.png";
import Mail from "../assets/mail.png";
import Location from "../assets/location.png";
import Age from "../assets/age.png";
import Call from "../assets/call.png";

import Scheduled from "./Scheduled";
import Summary from "./Summary";
import LastWeekLog from "./LastWeekLog";

type ProfileData = {
  uid: string;
  firstName: string;
  middleInitial?: string | null;
  surname: string;
  email: string;
  admin: boolean;
  status: string;
  approved: boolean;
  phone?: string;
  age?: string;
  gender?: string;
  location?: string;
  createdAt: Date | { seconds: number; nanoseconds: number }; // Firestore timestamp
};


const Profile = () => {


  const { currentUser } = useAuth();
  const [profileData, setProfileData] = useState<ProfileData | null>(null);


  useEffect(() => {
    const fetchProfile = async () => {
      if (currentUser) {
        const docRef = doc(db, "users", currentUser.uid);
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
          setProfileData(docSnap.data() as ProfileData);
        }
      }
    };
    fetchProfile();
  }, [currentUser]);

  const [isEditing, setIsEditing] = useState(false);

  const handleChange = (field: keyof ProfileData, value: string) => {
    if (!profileData) return;
    setProfileData({ ...profileData, [field]: value });
  };
  const handleSave = async () => {
    if (!currentUser || !profileData) return;

    if (!profileData.phone?.match(/^\d{11}$/)) {
      alert("Phone number must be 11 digits.");
      return;
    }

    if (!profileData.age || isNaN(Number(profileData.age))) {
      alert("Age must be a valid number.");
      return;
    }

    if (!profileData.gender) {
      alert("Please select a gender.");
      return;
    }

    if (!profileData.location?.trim()) {
      alert("Location cannot be empty.");
      return;
    }

    const docRef = doc(db, "users", currentUser.uid);
    await updateDoc(docRef, {
      phone: profileData.phone || "",
      age: profileData.age || "",
      gender: profileData.gender || "",
      location: profileData.location || "",
    });
    setIsEditing(false);
  };




  const [profileToggle, setProfileToggle] = useState(1);
  const handleProfileClick = (value) => {
    setProfileToggle(value);
  };

  const [activeButton, setActiveButton] = useState("logs");

  const handleClick = (buttonName) => {
    setActiveButton(buttonName);
  };

  return (
    <div className={styles.Profile}>
      <span className={styles.Profile_title}>Profile</span>
      <div className={styles.Profile_inner}>
        <div className={styles.Profile_top}>
          <div className={styles.Profile_picture}>
            <img src={Avatar} alt="Profile Picture" />
            <span>{profileData?.firstName} {profileData?.surname}</span>
            <span>{profileData?.email}</span>
          </div>

          <div className={styles.Personal_details}>
            <div className={styles.Detail_head}>
              <span className={styles.Personal}>Personal Details</span>
              {!isEditing ? (
                <button className={styles.Edit} onClick={() => setIsEditing(true)}>
                  <img src={Edit} alt="Edit icon" />
                  <span>Edit</span>
                </button>
              ) : (
                <div>
                  <button className={styles.Save} style={{marginRight:5}} onClick={handleSave}>
                    <span>Save</span>
                  </button>
                  <button className={styles.Cancel}  onClick={() => setIsEditing(false)}>
                    <span>Cancel</span>
                  </button>
                </div>
              )}
            </div>

            <div className={styles.Details_container}>
              <div className={styles.Detail}>
                <img src={User} alt="User icon" />
                <div className={styles.Details_input}>
                  <label htmlFor="">Name:</label>
                  <input
                    type="text"
                    value={`${profileData?.firstName || ""} ${profileData?.surname || ""}`}
                    readOnly
                  />
                </div>
              </div>

              <div className={styles.Detail}>
                <img src={Mail} alt="Email icon" />
                <div className={styles.Details_input}>
                  <label htmlFor="">Email:</label>
                  <input
                    type="text"
                    value={profileData?.email || ""}
                    readOnly
                  />
                </div>
              </div>

              <div className={styles.Detail}>
                <img src={Location} alt="Location icon" />
                <div className={styles.Details_input}>
                  <label htmlFor="">Location:</label>
                  <input
                    type="text"
                    value={profileData?.location || ""}
                    readOnly={!isEditing}
                    onChange={(e) => handleChange("location", e.target.value)}
                  />
                </div>
              </div>

              <div className={styles.Detail}>
                <img src={Call} alt="Phone icon" />
                <div className={styles.Details_input}>
                  <label htmlFor="">Phone:</label>
                  <input
                    type="tel"
                    value={profileData?.phone || ""}
                    readOnly={!isEditing}
                    onChange={(e) => handleChange("phone", e.target.value.replace(/\D/, ""))}
                    maxLength={11}
                    pattern="[0-9]{11}"
                  />
                </div>
              </div>

              <div className={styles.Detail}>
                <img src={Age} alt="Age icon" />
                <div className={styles.Details_input}>
                  <label htmlFor="">Age:</label>
                  <input
                    type="number"
                    min="18"
                    max="60"
                    value={profileData?.age || ""}
                    readOnly={!isEditing}
                    onChange={(e) => handleChange("age", e.target.value)}
                  />
                </div>
              </div>

              <div className={styles.Detail}>
                <img src={Gender} alt="Gender icon" />
                <div className={styles.Details_input}>
                  <label htmlFor="">Gender:</label>

                  {!isEditing ? (
                    <span>{profileData?.gender || "Not Provided"}</span>
                  ) : (
                    <select
                      value={profileData?.gender || ""}
                      onChange={(e) => handleChange("gender", e.target.value)}
                    >
                      <option value="Male">Male</option>
                      <option value="Female">Female</option>
                      <option value="Others">Others</option>
                    </select>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className={styles.Profile_bottom}>
          <div className={styles.Bottom_button}>
            <button
              onClick={() => {
                handleProfileClick(1);
                handleClick("logs");
              }}
              className={activeButton === "logs" ? styles.Active : ""}
            >
              Last week
            </button>

            <button
              onClick={() => {
                handleProfileClick(2);
                handleClick("schedule");
              }}
              className={activeButton === "schedule" ? styles.Active : ""}
            >
              Schedule
            </button>

            <button
              onClick={() => {
                handleProfileClick(3);
                handleClick("summary");
              }}
              className={activeButton === "summary" ? styles.Active : ""}
            >
              Summary
            </button>
          </div>

          {profileToggle === 1 && <LastWeekLog />}
          {profileToggle === 2 && <Scheduled />}
          {profileToggle === 3 && <Summary />}
        </div>
      </div>
    </div>
  );
};

export default Profile;
