import styles from '../css/Out.module.css'
import { db } from "../firebase"; 
import { doc, deleteDoc } from "firebase/firestore";

interface RejectProps {
    userId: string;
  }

  const Reject = ({ userId }: RejectProps) => {
    const handleReject = async () => {
      const confirm = window.confirm("Are you sure you want to reject this user?");
      if (!confirm) return;
  
      try {
        await deleteDoc(doc(db, "users", userId));
      } catch (error) {
        console.error("Error rejecting user:", error);
      }
    };
    return(
        <button className={styles.Reject} onClick={handleReject}>
          Reject
        </button>
    )
}

export default Reject;