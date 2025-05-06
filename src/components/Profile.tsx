import { useState } from "react";

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

const Profile = () => {
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
            <span>Dowelle Dayle Mon</span>
            <span>dowellemon@gmail.com</span>
          </div>

          <div className={styles.Personal_details}>
            <div className={styles.Detail_head}>
              <span className={styles.Personal}>Personal Details</span>
              <button className={styles.Edit}>
                <img src={Edit} alt="Edit icon" />
                <span>Edit</span>
              </button>
            </div>

            <div className={styles.Details_container}>
              <div className={styles.Detail}>
                <img src={User} alt="User icon" />
                <div className={styles.Details_input}>
                  <label htmlFor="">Name:</label>
                  <input type="text" value="Dowelle Dayle Mon" />
                </div>
              </div>

              <div className={styles.Detail}>
                <img src={Mail} alt="User icon" />
                <div className={styles.Details_input}>
                  <label htmlFor="">Email:</label>
                  <input type="text" value="dowelledayle@gmail.com" />
                </div>
              </div>

              <div className={styles.Detail}>
                <img src={Location} alt="User icon" />
                <div className={styles.Details_input}>
                  <label htmlFor="">Location:</label>
                  <input type="text" value="Not Provided" />
                </div>
              </div>

              <div className={styles.Detail}>
                <img src={Call} alt="User icon" />
                <div className={styles.Details_input}>
                  <label htmlFor="">Phone:</label>
                  <input type="text" value="09123456789" />
                </div>
              </div>

              <div className={styles.Detail}>
                <img src={Age} alt="User icon" />
                <div className={styles.Details_input}>
                  <label htmlFor="">Age:</label>
                  <input type="text" value="22" />
                </div>
              </div>

              <div className={styles.Detail}>
                <img src={Gender} alt="User icon" />
                <div className={styles.Details_input}>
                  <label htmlFor="">Gender:</label>
                  <input type="text" value="Dowelle Dayle Mon" />
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
