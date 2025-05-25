import { useState, useEffect } from "react";
import { useAuth } from "../context/AuthContext";
import { doc, getDoc, updateDoc } from "firebase/firestore";
import { db, firebaseStorage } from "../firebase";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";

import styles from "../css/Profile.module.css";
import Avatar from "../assets/avatar.png";
import Edit from "../assets/Edit.png";
import User from "../assets/user.png";
import Mail from "../assets/mail.png";
import Logout from '../assets/logout-w.png'
import Pass from '../assets/padlock.png'
import Key from '../assets/key.png'

import Scheduled from "./Scheduled";
import Summary from "./Summary";
import LastWeekLog from "./LastWeekLog";
import { auth } from "../firebase";
import { EmailAuthProvider, reauthenticateWithCredential, updatePassword } from "firebase/auth";

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
  avatar?: string;
  createdAt: Date | { seconds: number; nanoseconds: number }; // Firestore timestamp
};

type ProfileProps = {
  userId?: string; // Add this prop type
};

const Profile = ({ userId }: ProfileProps) => {
  const [isViewingOtherProfile, setIsViewingOtherProfile] = useState(false);
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !currentUser) return;

    const storageRef = ref(firebaseStorage, `avatars/${currentUser.uid}`);
    await uploadBytes(storageRef, file);

    const downloadURL = await getDownloadURL(storageRef);
    setProfileData((prev) =>
      prev ? { ...prev, avatar: downloadURL } : null
    );
  };



  const { currentUser } = useAuth();
  const [profileData, setProfileData] = useState<ProfileData | null>(null);

  const isGoogleSignedIn = currentUser?.providerData?.some(
  (provider) => provider.providerId === 'google.com'
);

  useEffect(() => {
    const fetchProfile = async () => {
      try {
        const targetUserId = userId || currentUser?.uid;
        if (!targetUserId) return;

        setIsViewingOtherProfile(!!userId && userId !== currentUser?.uid);

        const docRef = doc(db, "users", targetUserId);
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
          setProfileData(docSnap.data() as ProfileData);
        }
      } catch (error) {
        console.error("Error fetching profile:", error);
      }
    };
    fetchProfile();
  }, [currentUser, userId]);


  // useEffect(() => {
  //   const fetchProfile = async () => {
  //     if (currentUser) {
  //       const docRef = doc(db, "users", currentUser.uid);
  //       const docSnap = await getDoc(docRef);
  //       if (docSnap.exists()) {
  //         setProfileData(docSnap.data() as ProfileData);
  //       }
  //     }
  //   };
  //   fetchProfile();
  // }, [currentUser]);

  const [isEditing, setIsEditing] = useState(false);

  const handleChange = (field: keyof ProfileData, value: string) => {
    if (!profileData) return;
    setProfileData({ ...profileData, [field]: value });
  };
  const handleSave = async () => {
    if (!currentUser || !profileData) return;

    const firebaseUser = auth.currentUser;

    if (!firebaseUser) {
      alert("No authenticated user found.");
      return;
    }

    // Check if user is Google-signed-in
    const isGoogleSignedIn = firebaseUser.providerData?.some(
      (provider) => provider.providerId === 'google.com'
    );

    if ((newPassword || confirmPassword) && !isGoogleSignedIn) {
      if (newPassword !== confirmPassword) {
        alert("Passwords do not match.");
        return;
      }
      if (newPassword.length < 8) {
        alert("Password should be at least 8 characters.");
        return;
      }
      if (!currentPassword) {
        alert("Please enter your current password to confirm.");
        return;
      }

      try {
        const credential = EmailAuthProvider.credential(
          firebaseUser.email!,
          currentPassword
        );
        await reauthenticateWithCredential(firebaseUser, credential);
        await updatePassword(firebaseUser, newPassword);
        alert("Password updated successfully.");
      } catch (error) {
        console.error("Error updating password:", error);
        alert("Failed to update password. Your current password may be incorrect.");
        return;
      }
    } else if (isGoogleSignedIn && (newPassword || confirmPassword)) {
      alert("Google-signed-in users cannot change password here.");
      return;
    }

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
      avatar: profileData.avatar || "",
    });
    setIsEditing(false);
    setNewPassword(""); // Clear fields after save
    setConfirmPassword("");
    setCurrentPassword("");
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
      <span className={styles.Profile_up}>
        <span className={styles.Profile_title}>Profile</span>
        {profileData?.admin || isViewingOtherProfile && (
          <div className={styles.AdminBadge}>
            <span>ADMIN VIEW</span>
          </div>
        )}
        <img src={Logout} alt="logout" />
      </span>
      <div className={styles.Profile_inner}>
        <div className={styles.Profile_top}>
          <div className={styles.Profile_picture}>
            <label htmlFor="avatarUpload">
              <img
                src={profileData?.avatar || Avatar}
                alt="Profile"
                className={styles.AvatarImage}
                style={{ cursor: isEditing ? "pointer" : "default" }}
              />
            </label>
            {isEditing && (
              <input
                type="file"
                id="avatarUpload"
                accept="image/*"
                onChange={handleAvatarUpload}
                style={{ display: "none" }}
              />
            )}

            <span>{profileData?.firstName} {profileData?.surname}</span>
            <span>{profileData?.email}</span>
          </div>

          <div className={styles.Personal_details}>
            <div className={styles.Detail_head}>
              <span className={styles.Personal}>Personal Details</span>
              {!isViewingOtherProfile && (
                <>
                  {!isEditing ? (
                    <button className={styles.Edit} onClick={() => setIsEditing(true)}>
                      <img src={Edit} alt="Edit icon" />
                      <span>Edit</span>
                    </button>
                  ) : (
                    <div className={styles.Saved}>
                      <button className={styles.Save} style={{ marginRight: 5 }} onClick={handleSave}>
                        <span>Save</span>
                      </button>
                      <button className={styles.Cancel} onClick={() => setIsEditing(false)}>
                        <span>Cancel</span>
                      </button>
                    </div>
                  )}
                </>
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
{!isGoogleSignedIn && (
  <>
              <div className={styles.Detail}>
                <img src={Key} alt="Current Password icon" />
                <div className={styles.Details_input}>
                  <label htmlFor="">Current Password:</label>
                  <input
                    type="password"
                    value={currentPassword}
                    readOnly={!isEditing}
                    onChange={(e) => setCurrentPassword(e.target.value)}
                  />
                </div>
              </div>


              <div className={styles.Detail}>
                <img src={Pass} alt="Location icon" />
                <div className={styles.Details_input}>
                  <label htmlFor="">New Password:</label>
                  <input
                    type="password"
                    value={newPassword}
                    readOnly={!isEditing}
                    onChange={(e) => setNewPassword(e.target.value)}
                  />
                </div>
              </div>

              <div className={styles.Detail}>
                <img src={Key} alt="Phone icon" />
                <div className={styles.Details_input}>
                  <label htmlFor="">Confirm Password:</label>
                  <input
                    type="password"
                    value={confirmPassword}
                    readOnly={!isEditing}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                  />
                </div>
              </div>
              </>
)}
{isGoogleSignedIn && isEditing && (
  <div className={styles.OAuthNotice}>
    <p>You signed in with Google.</p>
    <a 
      href="https://myaccount.google.com/security" 
      target="_blank"
      rel="noopener noreferrer"
    >
      Manage your Google account password
    </a>
  </div>
)}


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

          {profileToggle === 1 && <LastWeekLog userId={userId} />}
          {profileToggle === 2 && <Scheduled />}
          {profileToggle === 3 && <Summary userId={userId} />}
        </div>
      </div>
    </div>
  );
};

export default Profile;
