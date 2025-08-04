import { initializeApp, getApp, getApps } from "firebase/app";
import { getAnalytics } from "firebase/analytics";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { getStorage } from "firebase/storage";
import {getDatabase} from "firebase/database";
import { setPersistence, browserLocalPersistence } from "firebase/auth";


// --- Main App ---
const firebaseConfig = {
  apiKey: "AIzaSyCgvmk0MnyY77V7hCNKxejtHEr5YKfZvAM",
  authDomain: "als-dtr.firebaseapp.com",
  databaseURL: "https://als-dtr-default-rtdb.asia-southeast1.firebasedatabase.app/", 
  projectId: "als-dtr",
  storageBucket: "als-dtr.firebasestorage.app",
  messagingSenderId: "629844869604",
  appId: "1:629844869604:web:5781c935865eb278a947f1",
  measurementId: "G-4X5C203ZGY"
};

// --- Secondary App ---
const firebaseConfig2 = {
  apiKey: "AIzaSyBaTXoR-GZfxiU17t7aS2EvdcinRWlArEs",
  authDomain: "auth2only.firebaseapp.com",
  projectId: "auth2only",
  storageBucket: "auth2only.firebasestorage.app",
  messagingSenderId: "1033182969890",
  appId: "1:1033182969890:web:f0d0d52102c26ce70c8a7b",
  measurementId: "G-EE1G8YHYV0"
};

// Initialize default app (DTR)
const app = getApps().length === 0 
  ? initializeApp(firebaseConfig)
  : getApp();

// Initialize secondary app (auth only for adding accounts.)
const app2 = getApps().find(app => app.name === "secondary") 
  || initializeApp(firebaseConfig2, "secondary");

// Services
const analytics = getAnalytics(app);
const auth = getAuth(app);
const db = getFirestore(app);
const rt = getDatabase(app)
const imageDb = getStorage(app);

// For secondary app (optional usage)
import {getAuth as getAuth2} from "firebase/auth";
import {getFirestore as getFirestore2} from "firebase/firestore"
import {getStorage as getStorage2} from "firebase/storage"

const auth2 = getAuth2(app2);
const db2 = getFirestore2(app2);
const firebaseStorage = getStorage2(app2);


setPersistence(auth, browserLocalPersistence);

export { app, analytics, auth, db, imageDb, app2, auth2, db2, firebaseStorage, rt};
