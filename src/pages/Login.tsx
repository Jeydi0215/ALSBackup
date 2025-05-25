import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { signInWithEmailAndPassword, signInWithPopup, GoogleAuthProvider } from "@firebase/auth";
import { auth, db } from "../firebase.ts";
import { FirebaseError } from "firebase/app";
import styles from "../css/Auth.module.css";

import ALS from "../assets/ALS-logo.png";
import Close from "../assets/close.png";
import { doc, updateDoc } from "firebase/firestore";

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
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const navigate = useNavigate();

  const toggleForgotModal = () => setShowForgot((prev) => !prev);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    try {
      const result = await signInWithEmailAndPassword(auth, email, password);
      const user = result.user;
      
        if (user) {
          // Update the status to online when the user successfully logs in
          const userDocRef = doc(db, "users", user.uid);
          await updateDoc(userDocRef, {
            status: "online",
          });
  
          // Redirect to Home page
          navigate("/Home", {replace: true});
        }
      
    } catch (err) {
      if (err instanceof FirebaseError) {
        setError(err.message);
      } else {
        setError("An unexpected error occurred.");
      }
    }
  };

  const handleGoogleLogin = async () => {
    const provider = new GoogleAuthProvider();
  
    try {
      const result = await signInWithPopup(auth, provider);
      const user = result.user;
  
      if (user) {
        // Update the status to online when the user successfully logs in
        const userDocRef = doc(db, "users", user.uid);
        await updateDoc(userDocRef, {
          status: "online",
        });

        // Redirect to Home page
        navigate("/Home", {replace: true});
      }
    
    } catch (err) {
      if (err instanceof FirebaseError) {
        setError(err.message);
      } else {
        setError("An unexpected error occurred.");
      }
    }
  };
  

  return (
    <div className={styles.Main}>
      <div className={styles.Login}>
        <div className={styles.Top}>
          <img src={ALS} alt="ALS logo" />
          <span className={styles.Create}>Daily Time Record</span>
        </div>

        <form onSubmit={handleLogin}>
          <div className={styles.Form_inner}>
            <label htmlFor="email">Email:</label>
            <input
              id="email"
              type="email"
              placeholder="Enter your email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>
          <div className={styles.Form_inner}>
            <label htmlFor="password">Password:</label>
            <input
              id="password"
              type="password"
              placeholder="Enter your password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
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
            <button type="button" onClick={handleGoogleLogin}>Log In with Google</button>
          </div>

          <span className={styles.Already}>
            Don't have an account?
            <Link className={styles.Dont} to="/Signup">
              Sign up
            </Link>
          </span>
          {error && <p style={{ color: 'red' }}>{error}</p>}
        </form>
      </div>

      {showForgot && <ForgotPasswordModal onClose={toggleForgotModal} />}
    </div>
  );
};

export default Login;
