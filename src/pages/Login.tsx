import { useState } from "react";
import { Link } from "react-router-dom";
import styles from "../css/Auth.module.css";

import ALS from "../assets/ALS-logo.png";
import Close from "../assets/close.png";

const ForgotPasswordModal = ({ onClose }: { onClose: () => void }) => (
  <div className={styles.Forgot}>
    <div className={styles.Forgot_inner}>
      <div className={styles.Forgot_head}>
        <span>Forgot password</span>
        <img onClick={onClose} src={Close} alt="Close button" />
      </div>
      <input type="email" placeholder="Enter your email" />
      <button>Send password reset email</button>
    </div>
  </div>
);

const Login = () => {
  const [showForgot, setShowForgot] = useState(false);

  const toggleForgotModal = () => setShowForgot((prev) => !prev);

  return (
    <div className={styles.Main}>
      <div className={styles.Login}>
        <div className={styles.Top}>
          <img src={ALS} alt="ALS logo" />
          <span className={styles.Create}>Daily Time Record</span>
        </div>

        <form>
          <div className={styles.Form_inner}>
            <label htmlFor="email">Email:</label>
            <input
              id="email"
              type="email"
              placeholder="Enter your email"
              required
            />
          </div>
          <div className={styles.Form_inner}>
            <label htmlFor="password">Password:</label>
            <input
              id="password"
              type="password"
              placeholder="Enter your password"
              required
            />
          </div>

          <div className={styles.Remember}>
            <div className={styles.Remember_inner}>
              <input type="checkbox" id="remember" />
              <label htmlFor="remember">Remember me</label>
            </div>

            <button
              type="button"
              onClick={toggleForgotModal}
              className={styles.Forgott}
            >
              Forgot Password?
            </button>
          </div>

          <div className={styles.Form_button}>
            <button type="submit">Log in</button>
            <button type="button">Log In with Google</button>
          </div>

          <span className={styles.Already}>
            Don't have an account?
            <Link className={styles.Dont} to="/Signup">
              Sign up
            </Link>
          </span>
        </form>
      </div>

      {showForgot && <ForgotPasswordModal onClose={toggleForgotModal} />}
    </div>
  );
};

export default Login;
