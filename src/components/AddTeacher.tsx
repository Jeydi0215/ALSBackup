import { useState } from "react";
import styles from "../css/AddTeacher.module.css";
import Close from "../assets/close.png";

import { db } from "../firebase";
import { auth2 } from "../firebase"; // secondary auth instance
import { createUserWithEmailAndPassword, signOut } from "firebase/auth";
import { doc, setDoc } from "firebase/firestore";

type Props = {
  handleAddTeacher: () => void;
};

const AddTeacher = ({ handleAddTeacher }: Props) => {
  const [firstName, setFirstName] = useState("");
  const [surname, setLastName] = useState("");
  const [middleInitial, setMiddleInitial] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    try {
      const userCredential = await createUserWithEmailAndPassword(auth2, email, password);
      const uid = userCredential.user.uid;

      await setDoc(doc(db, "users", uid), {
        uid,
        firstName,
        middleInitial,
        surname,
        email,
        admin: false,
        status: "offline",
        approved: true,
        isEmployee: true,
        createdAt: new Date(),
      });

      await signOut(auth2); // Sign out from secondary auth instance only
      handleAddTeacher();   // Close modal
    } catch (err: any) {
      setError(err.message || "Failed to add teacher");
    }
  };

  return (
    <div className={styles.AddTeacher}>
      <div className={styles.Head_add}>
        <h1>Add Teacher</h1>
        <img onClick={handleAddTeacher} src={Close} alt="Close" />
      </div>
      <form onSubmit={handleSubmit}>
        <div>
          <label>First Name:</label>
          <input
            type="text"
            placeholder="Enter first name.."
            value={firstName}
            onChange={(e) => setFirstName(e.target.value)}
            required
          />
        </div>

        <div>
          <label>Middle Initial</label>
          <input
            type="text"
            placeholder="Enter middle initial.."
            value={middleInitial}
            onChange={(e) => setMiddleInitial(e.target.value)}
            required
          />
        </div>

        <div>
          <label>Last Name:</label>
          <input
            type="text"
            placeholder="Enter last name.."
            value={surname}
            onChange={(e) => setLastName(e.target.value)}
            required
          />
        </div>

        <div>
          <label>Email:</label>
          <input
            type="email"
            placeholder="Enter email address.."
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
        </div>

        <div>
          <label>Password:</label>
          <input
            type="password"
            placeholder="Enter password.."
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
        </div>

        {error && <p style={{ color: "red" }}>{error}</p>}

        <button type="submit">Submit</button>
      </form>
    </div>
  );
};

export default AddTeacher;
