import { useState, useEffect } from "react";
import { db } from "../firebase";
import { collection, addDoc, getDocs, deleteDoc, doc } from "firebase/firestore";
import styles from "../css/Calendar.module.css";
import Trash from "../assets/trash.png";

const Calendar = () => {
  const [holidayInput, setHolidayInput] = useState("");
  const [customHolidays, setCustomHolidays] = useState<any[]>([]);
  const [showAdd, setShowAdd] = useState(false);
  const [loading, setLoading] = useState(false);

  // Fetch holidays from Firestore
  const fetchHolidays = async () => {
    try {
      setLoading(true);
      const snapshot = await getDocs(collection(db, "customHolidays"));
      const holidays = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
      setCustomHolidays(holidays);
    } catch (error) {
      console.error("Error fetching holidays:", error);
      alert("Failed to fetch holidays. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  // Check if date is valid
  const isValidDate = (dateString: string) => {
    return !isNaN(new Date(dateString).getTime());
  };

  // Add holiday to Firestore
  const addHoliday = async () => {
    if (!holidayInput || !isValidDate(holidayInput)) {
      alert("Please select a valid date!");
      return;
    }

    const isDuplicate = customHolidays.some(
      (holiday) => holiday.date === holidayInput
    );

    if (isDuplicate) {
      alert("This date is already a holiday!");
      return;
    }

    try {
      setLoading(true);
      await addDoc(collection(db, "customHolidays"), {
        date: holidayInput,
      });
      fetchHolidays();
      setHolidayInput("");
      setShowAdd(false);
    } catch (error) {
      console.error("Error adding holiday:", error);
      alert("Failed to add holiday. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  // Delete holiday
  const deleteHoliday = async (id: string) => {
    try {
      setLoading(true);
      await deleteDoc(doc(db, "customHolidays", id));
      fetchHolidays();
    } catch (error) {
      console.error("Error deleting holiday:", error);
      alert("Failed to delete holiday. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  // Toggle modal
  const handleShowClick = () => {
    if (!holidayInput) {
      alert("Please select a date first!");
      return;
    }
    setShowAdd(true);
  };

  useEffect(() => {
    fetchHolidays();
  }, []);

  return (
    <div className={styles.Calendar}>
      <span className={styles.Calendar_title}>Calendar</span>
      <div className={styles.Calendar_inner}>
        <div className={styles.Calendar_button}>
          <span>Custom Holidays</span>
          <div>
            <input
              type="date"
              value={holidayInput}
              onChange={(e) => setHolidayInput(e.target.value)}
            />
            <button onClick={handleShowClick} disabled={loading}>
              {loading ? "Processing..." : "Add Holiday"}
            </button>
          </div>
        </div>

        <div className={styles.Holiday_con}>
          {loading ? (
            <p>Loading holidays...</p>
          ) : customHolidays.length === 0 ? (
            <p>No custom holidays added yet.</p>
          ) : (
            customHolidays.map((holiday) => (
              <div key={holiday.id} className={styles.Holiday}>
                <span>
                  {new Date(holiday.date).toLocaleDateString("en-US", {
                    month: "long",
                    day: "2-digit",
                    year: "numeric",
                  })}
                </span>
                <img
                  src={Trash}
                  alt="Delete"
                  onClick={() => !loading && deleteHoliday(holiday.id)}
                  style={{ cursor: loading ? "not-allowed" : "pointer" }}
                />
              </div>
            ))
          )}
        </div>
      </div>

      {/* Confirmation modal */}
      {showAdd && (
        <div className={styles.Add_holiday}>
          Are you sure you want to add{" "}
          {new Date(holidayInput).toLocaleDateString("en-US", {
            month: "long",
            day: "2-digit",
            year: "numeric",
          })}{" "}
          as a custom Holiday?
          <div className={styles.Add_button}>
            <button onClick={() => setShowAdd(false)} disabled={loading}>
              Cancel
            </button>
            <button onClick={addHoliday} disabled={loading}>
              {loading ? "Adding..." : "Submit"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default Calendar;