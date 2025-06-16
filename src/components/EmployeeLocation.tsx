import { useEffect, useState } from "react";
import styles from "../css/EmployeeLocation.module.css";
import Dowelle from "../assets/Dowelle.avif";
import { db } from "../firebase";
import {
  doc,
  setDoc,
  onSnapshot,
  collection,
  getDocs,
  deleteDoc,
} from "firebase/firestore";

interface LocationData {
  id: string;
  uid: string;
  name: string;
  surname: string;
  email: string;
  latitude: number;
  longitude: number;
  sharedAt: Date;
}

const EmployeeLocation = () => {
  const [locationSharingEnabled, setLocationSharingEnabled] = useState(false);
  const [locations, setLocations] = useState<LocationData[]>([]);
  const [loading, setLoading] = useState(true);

  // Realtime listener for locationTrigger status
  useEffect(() => {
    const unsubTrigger = onSnapshot(doc(db, "system", "locationTrigger"), (docSnap) => {
      const data = docSnap.data();
      setLocationSharingEnabled(data?.shareLocationRequest || false);
    });

    return () => unsubTrigger();
  }, []);

  // Realtime listener for locations collection
  useEffect(() => {
    let unsubLocations: () => void;

    if (locationSharingEnabled) {
      setLoading(true);
      unsubLocations = onSnapshot(
        collection(db, "locations"),
        (snapshot) => {
          const fetched = snapshot.docs.map(doc => {
            const data = doc.data();
            return {
              id: doc.id,
              ...data,
              sharedAt: data.sharedAt.toDate(),
            } as LocationData;
          });
          setLocations(fetched);
          setLoading(false);
        },
        (error) => {
          console.error("Error listening to locations:", error);
          setLoading(false);
        }
      );
    } else {
      setLocations([]);
      setLoading(false);
    }

    return () => {
      if (unsubLocations) unsubLocations();
    };
  }, [locationSharingEnabled]);

  const handleToggle = async () => {
    const newStatus = !locationSharingEnabled;

    try {
      await setDoc(doc(db, "system", "locationTrigger"), {
        shareLocationRequest: newStatus,
        timestamp: Date.now(),
      });

      if (!newStatus) {
        // Delete all locations when turning off
        const snapshot = await getDocs(collection(db, "locations"));
        const deletePromises = snapshot.docs.map(doc => deleteDoc(doc.ref));
        await Promise.all(deletePromises);
      }
    } catch (error) {
      console.error("Error toggling location sharing:", error);
    }
  };

  const openGoogleMaps = (lat: number, lng: number) => {
    window.open(`https://www.google.com/maps?q=${lat},${lng}`, "_blank");
  };

  return (
    <div className={styles.EmployeeLocation}>
      <h2 className={styles.Location_title}>Employee Location Tracker</h2>

      <div className={styles.controls}>
        <label className={styles.ToggleWrapper}>
          <span>{locationSharingEnabled ? "Sharing Active" : "Sharing Inactive"}</span>
          <input
            type="checkbox"
            checked={locationSharingEnabled}
            onChange={handleToggle}
          />
          <span className={styles.Slider}></span>
        </label>
        
        <div className={styles.status}>
          {loading ? "Updating..." : `${locations.length} active locations`}
        </div>
      </div>

      <div className={styles.Location_container}>
        {loading ? (
          <div className={styles.loading}>Loading locations...</div>
        ) : locations.length === 0 ? (
          <div className={styles.empty}>
            {locationSharingEnabled
              ? "Waiting for location updates..."
              : "Enable sharing to view locations"}
          </div>
        ) : (
          locations.map((loc) => (
            <div 
              className={styles.SpecificLocation} 
              key={loc.id}
              onClick={() => openGoogleMaps(loc.latitude, loc.longitude)}
              title="Click to view in Google Maps"
            >
              <div className={styles.Location_inner}>
                <img src={Dowelle} alt="avatar" className={styles.avatar} />
                <div className={styles.userInfo}>
                  <span className={styles.name}>
                    {loc.name} {loc.surname}
                  </span>
                  <span className={styles.email}>{loc.email}</span>
                </div>
              </div>
              <div className={styles.timeInfo}>
                <span>{loc.sharedAt.toLocaleDateString()}</span>
                <span>{loc.sharedAt.toLocaleTimeString()}</span>
              </div>
              <div className={styles.coordinates}>
                <span>Lat: {loc.latitude.toFixed(6)}</span>
                <span>Lng: {loc.longitude.toFixed(6)}</span>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
};

export default EmployeeLocation;