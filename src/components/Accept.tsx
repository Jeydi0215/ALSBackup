import styles from '../css/Out.module.css'
import { db } from "../firebase"; 
import { doc, updateDoc } from "firebase/firestore";

interface AcceptProps {
    userId: string;
  }

  const Accept = ({ userId }: AcceptProps) => {
    const handleAccept = async () => {
      try {
        const userRef = doc(db, "users", userId);
        await updateDoc(userRef, {
          approved: true,
        });
        console.log("User approved!");
      } catch (error) {
        console.error("Error approving user:", error);
      }
    };
  
    return(
        <button className={styles.Accept} onClick={handleAccept}> 
            Accept
        </button>
    )
}

export default Accept;