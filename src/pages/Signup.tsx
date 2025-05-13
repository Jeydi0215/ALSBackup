import { Link, useNavigate } from "react-router-dom";
import styles from "../css/Auth.module.css";
import { useState } from "react";
import { createUserWithEmailAndPassword, sendEmailVerification, GoogleAuthProvider, signInWithPopup } from "firebase/auth";
import { FirebaseError } from "firebase/app";
import { auth, db } from "../firebase";
import { doc, setDoc, getDoc } from "firebase/firestore";


import ALS from "../assets/ALS-logo.png";
import { message } from "antd";
const Signup = () => {
  const navigate = useNavigate()

  const [firstName, setFirstName] = useState("");
  const [middleInitial, setMiddleInitial] = useState("");
  const [surname, setSurname] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState<string | null>(null);

  const validatePassword = (password: string) => {
    const regex = /^(?=.*[A-Z])(?=.*\d)[A-Za-z\d]{8,}$/;
    return regex.test(password);
  };

  const checkAutoRejectEnabled = async () => {
    try {
      const settingsDoc = doc(db, "settings", "adminSettings");
      const docSnap = await getDoc(settingsDoc);
      return docSnap.exists() ? docSnap.data().autoRejectEnabled : false;
    } catch (error) {
      console.error("Error checking auto-reject setting:", error);
      return false; // Default to false if there's an error
    }
  };

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!firstName.trim() || !surname.trim()) {
      setError("First name and surname are required.");
      return;
    }

    if (password !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }

    if (!validatePassword(password)) {
      setError("Password must be at least 8 characters, include 1 uppercase letter and 1 number.");
      return;
    }

    try {
      const isAutoRejectEnabled = await checkAutoRejectEnabled();
      if (isAutoRejectEnabled) {
        setError("New sign-ups are currently not being accepted. Please try again later.");
        return;
      }

      const userCredential = await createUserWithEmailAndPassword(auth, email, password);
      const user = userCredential.user;
      //email verification
      await sendEmailVerification(userCredential.user);
      message.success("Verification email sent! Please check your inbox.");

      // Save additional user data to Firestore
      await setDoc(doc(db, "users", user.uid), {
        uid: user.uid,
        firstName: firstName.trim(),
        middleInitial: middleInitial.trim() || null,
        surname: surname.trim(),
        email: user.email,
        admin: false,
        status: "offline",
        approved: false, // admin must approve
        phone: "",       // added
        age: "",         // added
        gender: "",      // added
        location: "",    // added
        createdAt: new Date()
      });

      navigate("/");
    } catch (error: unknown) {
      if (error instanceof Error) {
        setError(error.message);
      } else {
        setError("An unknown error occurred.");
      }
    }
  };

  const handleGoogleLogin = async () => {
    const provider = new GoogleAuthProvider();
    try {
      const isAutoRejectEnabled = await checkAutoRejectEnabled();
      if (isAutoRejectEnabled) {
        setError("New sign-ups are currently not being accepted. Please try again later.");
        return;
      }

      const result = await signInWithPopup(auth, provider);
      const user = result.user;

      const nameParts = user.displayName?.split(" ") || [];
      const firstName = nameParts[0] || "";
      const surname = nameParts.slice(1).join(" ") || "";

      await setDoc(doc(db, "users", user.uid), {
        uid: user.uid,
        firstName: firstName.trim(),
        middleInitial: middleInitial.trim() || null,
        surname: surname.trim(),
        email: user.email,
        admin: false,
        status: "offline",
        approved: false, // admin must approve
        phone: "",       // added
        age: "",         // added
        gender: "",      // added
        location: "",    // added
        createdAt: new Date()
      });

      navigate("/");
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
          <img src={ALS} alt="Main logo" />
          <span className={styles.Create}>Create an Account</span>
        </div>
        <form onSubmit={handleSignup}>
          <div className={styles.Form_inner}>
            <label htmlFor="firstName">First Name:</label>
            <input
              id="firstName"
              type="text"
              value={firstName}
              onChange={(e) => setFirstName(e.target.value)}
              placeholder="Enter your first name"
              required
            />
          </div>

          <div className={styles.Form_inner}>
            <label htmlFor="middleInitial">Middle Initial (optional):</label>
            <input
              id="middleInitial"
              type="text"
              value={middleInitial}
              onChange={(e) => setMiddleInitial(e.target.value)}
              placeholder="Enter your middle initial"
              maxLength={1}
            />
          </div>

          <div className={styles.Form_inner}>
            <label htmlFor="surname">Surname:</label>
            <input
              id="surname"
              type="text"
              value={surname}
              onChange={(e) => setSurname(e.target.value)}
              placeholder="Enter your surname"
              required
            />
          </div>
          <div className={styles.Form_inner}>
            <label htmlFor="email">Email:</label>
            <input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="Enter your email"
              required
            />
          </div>

          <div className={styles.Form_inner}>
            <label htmlFor="password">Password:</label>
            <input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Enter your password"
              required
            />
          </div>

          <div className={styles.Form_inner}>
            <label htmlFor="confirmPassword">Confirm Password:</label>
            <input
              id="confirmPassword"
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="Confirm your password"
              required
            />
          </div>
          <div className={styles.Form_button}>
            <button type="submit">Signup</button>
            <button onClick={handleGoogleLogin}>Sign Up with Google</button>
          </div>

          {error && <p style={{ color: "red", textAlign: "center" }}>{error}</p>}
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
