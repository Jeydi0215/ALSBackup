import styles from '../css/Monitoring.module.css'
import Accept from '../components/Accept';
import Reject from '../components/Reject';
import { db } from "../firebase"; // Adjust path based on your file structure
import { collection, onSnapshot, query, where, doc, updateDoc, getDoc, setDoc } from "firebase/firestore";
import { useEffect, useState } from 'react';
import { Switch, message } from 'antd';
interface User {
    id: string;
    firstName: string;
    surname: string;
    email: string;
  }

const Pending = () => {
    const [pendingUsers, setPendingUsers] = useState<User[]>([]);
    const [autoRejectEnabled, setAutoRejectEnabled] = useState(false);

    useEffect(() => {
    const checkAutoRejectSetting = async () => {
      const settingsDoc = doc(db, "settings", "adminSettings");
      const docSnap = await getDoc(settingsDoc);
      
      if (docSnap.exists()) {
        setAutoRejectEnabled(docSnap.data().autoRejectEnabled || false);
      }
    };
    
    checkAutoRejectSetting();
  }, []);

  const toggleAutoReject = async () => {
  try {
    const settingsDoc = doc(db, "settings", "adminSettings");
    const newValue = !autoRejectEnabled;
    
    // First check if document exists
    const docSnap = await getDoc(settingsDoc);
    
    if (!docSnap.exists()) {
      // Initialize document if it doesn't exist
      await setDoc(settingsDoc, { autoRejectEnabled: newValue });
    } else {
      // Update existing document
      await updateDoc(settingsDoc, {
        autoRejectEnabled: newValue
      });
    }
    
    setAutoRejectEnabled(newValue);
    message.success(`Auto-reject is now ${newValue ? 'enabled' : 'disabled'}`);
  } catch (error) {
    console.error("Error updating auto-reject setting:", error);
    message.error("Failed to update auto-reject setting");
  }
};

    useEffect(() => {
      const q = query(collection(db, "users"), where("approved", "==", false));
      const unsubscribe = onSnapshot(q, (querySnapshot) => {
        const usersList: User[] = [];
        querySnapshot.forEach((doc) => {
          const data = doc.data();
          usersList.push({
            id: doc.id,
            firstName: data.firstName,
            surname: data.surname,
            email: data.email,
          });
        });
        setPendingUsers(usersList);
      });
    
      return () => unsubscribe(); // cleanup on unmount
    }, []);

    return(
        <div className={styles.Pending}>
          <div style={{marginLeft: 20, marginBottom: 20}}>
        <h3>Auto-Reject New Sign-ups:</h3>
        <Switch 
          checked={autoRejectEnabled}
          onChange={toggleAutoReject}
          checkedChildren="ON"
          unCheckedChildren="OFF"
        />
        <p>
          {autoRejectEnabled 
            ? "New sign-ups will be automatically rejected." 
            : "New sign-ups will require manual approval."}
        </p>
      </div>
      <table>
        <thead>
          <tr>
            <th>Name</th>
            <th>Email</th>
            <th>Action</th>
          </tr>
        </thead>
        <tbody>
          {pendingUsers.length > 0 ? (
            pendingUsers.map((user) => (
              <tr key={user.id}>
                <td>{user.firstName} {user.surname}</td>
                <td>{user.email}</td>
                <td className={styles.Hold}>
                  <Accept userId={user.id} />
                  <Reject userId={user.id} />
                </td>
              </tr>
            ))
          ) : (
            <tr>
              <td colSpan={3}>No pending users found</td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
};

export default Pending;