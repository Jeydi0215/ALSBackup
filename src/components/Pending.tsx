import styles from '../css/Monitoring.module.css'
import Accept from '../components/Accept';
import Reject from '../components/Reject';
import { db } from "../firebase"; // Adjust path based on your file structure
import { collection, onSnapshot, query, where } from "firebase/firestore";
import { useEffect, useState } from 'react';

interface User {
    id: string;
    firstName: string;
    surname: string;
    email: string;
  }

const Pending = () => {
    const [pendingUsers, setPendingUsers] = useState<User[]>([]);

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