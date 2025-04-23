import { Link } from "react-router-dom";
import styles from "../css/Auth.module.css";

import ALS from "../assets/ALS-logo.png";
const Signup = () => {
  return (
    <div className={styles.Main}>
      <div className={styles.Login}>
        <div className={styles.Top}>
          <img src={ALS} alt="Main logo" />
          <span className={styles.Create}>Create an Account</span>
        </div>
        <form action="">
          <div className={styles.Form_inner}>
            <label htmlFor="">Name:</label>
            <input type="text" placeholder="Enter your full name" required />
          </div>
          <div className={styles.Form_inner}>
            <label htmlFor="">Email:</label>
            <input type="text" placeholder="Enter your email" required />
          </div>
          <div className={styles.Form_inner}>
            <label htmlFor="">Password:</label>
            <input type="text" placeholder="Enter your password" required />
          </div>

          <div className={styles.Form_inner}>
            <label htmlFor="">Confirm Password:</label>
            <input type="password" placeholder="Confirm your email" required />
          </div>
          <div className={styles.Form_button}>
            <button type="submit">Signup</button>
            <button>Sign Up with Google</button>
          </div>
        </form>

        <span className={styles.Already}>
          Already have an account?
          <Link className={styles.Dont} to="/">
            Log in
          </Link>
        </span>
      </div>
    </div>
  );
};

export default Signup;
