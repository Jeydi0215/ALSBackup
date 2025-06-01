import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { signInWithEmailAndPassword, signInWithPopup, GoogleAuthProvider } from "@firebase/auth";
import { auth, db } from "../firebase.ts";
import { FirebaseError } from "firebase/app";
import styles from "../css/Auth.module.css";

import ALS from "../assets/ALS-logo.png";
import Close from "../assets/close.png";
import { doc, updateDoc } from "firebase/firestore";
import { sendPasswordResetEmail } from "firebase/auth";

const ForgotPasswordModal = ({ onClose }: { onClose: () => void }) => {
  const [resetEmail, setResetEmail] = useState("");
  const [message, setMessage] = useState("");

  const handleReset = async () => {
    if (!resetEmail) {
      setMessage("Please enter your email.");
      return;
    }

    try {
      await sendPasswordResetEmail(auth, resetEmail);
      setMessage("✅ Password reset email sent!");
    } catch (err) {
      console.error(err)
      setMessage("❌ Failed to send reset email. Check the email address.");
    }
  };

  return (
    <div className={styles.Forgot}>
      <div className={styles.Forgot_inner}>
        <div className={styles.Forgot_head}>
          <span>Forgot password</span>
          <img onClick={onClose} src={Close} alt="Close button" />
        </div>
        <input
          type="email"
          placeholder="Enter your email"
          value={resetEmail}
          onChange={(e) => setResetEmail(e.target.value)}
        />
        <button onClick={handleReset}>Send password reset email</button>
        {message && <p style={{ marginTop: "10px", color: "black" }}>{message}</p>}
      </div>
    </div>
  );
};

const Login = () => {
  const [showForgot, setShowForgot] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const navigate = useNavigate();
  const [rememberMe, setRememberMe] = useState(false);

  const toggleForgotModal = () => setShowForgot((prev) => !prev);

  useEffect(() => {
  const savedEmail = localStorage.getItem("rememberedEmail");
  if (savedEmail) {
    setEmail(savedEmail);
    setRememberMe(true);
  }
}, []);


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

        if (rememberMe) {
          localStorage.setItem("rememberedEmail", email);
        } else {
          localStorage.removeItem("rememberedEmail");
        }

        // Redirect to Home page
        navigate("/Home", { replace: true });
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
        navigate("/Home", { replace: true });
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
              <input
                type="checkbox"
                id="remember"
                checked={rememberMe}
                onChange={() => setRememberMe(!rememberMe)}
              />
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
            {/* <button type="button" onClick={handleGoogleLogin}>Log In with Google</button> */}
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
