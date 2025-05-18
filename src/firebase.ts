import { initializeApp, getApp, getApps } from "firebase/app";
import { getAnalytics } from "firebase/analytics";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { getStorage } from "firebase/storage";
import {getDatabase} from "firebase/database";
import { setPersistence, browserLocalPersistence } from "firebase/auth";


// --- Main App ---
const firebaseConfig = {
  apiKey: "AIzaSyBwlqZVctCQhfKhKr6nIy3iBRHFdQMitdM",
  authDomain: "dtr-for-als.firebaseapp.com",
  databaseURL: "https://dtr-for-als-default-rtdb.asia-southeast1.firebasedatabase.app", 
  projectId: "dtr-for-als",
  storageBucket: "dtr-for-als.appspot.com",
  messagingSenderId: "739537628398",
  appId: "1:739537628398:web:c96c46119f1b513e2cd7ff",
  measurementId: "G-3BWZ1R5FFK",
};

// --- Secondary App ---
const firebaseConfig2 = {
  apiKey: "AIzaSyD51CM8E_rkkzrDywq6Cb5Q6Yp1Rurv2FA",
  authDomain: "salinterpret.firebaseapp.com",
  projectId: "salinterpret",
  storageBucket: "salinterpret.appspot.com",
  messagingSenderId: "513183016093",
  appId: "1:513183016093:web:3b5a92a4aefac3c6296074",
  measurementId: "G-ZY6B41RWF2", 
};

// Initialize default app (DTR)
const app = getApps().length === 0 
  ? initializeApp(firebaseConfig)
  : getApp();

// Initialize secondary app (Salinterpret)
const app2 = getApps().find(app => app.name === "secondary") 
  || initializeApp(firebaseConfig2, "secondary");

// Services
const analytics = getAnalytics(app);
const auth = getAuth(app);
const db = getFirestore(app);
const rt = getDatabase(app)

// For secondary app (optional usage)
import {getAuth as getAuth2} from "firebase/auth";
import {getFirestore as getFirestore2} from "firebase/firestore"
import {getStorage as getStorage2} from "firebase/storage"

const auth2 = getAuth2(app2);
const db2 = getFirestore2(app2);
const firebaseStorage = getStorage2(app2);
const imageDb = getStorage(app2);

setPersistence(auth, browserLocalPersistence);

export { app, analytics, auth, db, imageDb, app2, auth2, db2, firebaseStorage, rt};
