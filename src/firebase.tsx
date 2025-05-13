import { initializeApp } from "firebase/app";
import { getFirestore } from 'firebase/firestore';
import { getStorage } from "firebase/storage";

const firebaseConfig = {
  apiKey: "AIzaSyD51CM8E_rkkzrDywq6Cb5Q6Yp1Rurv2FA",
  authDomain: "salinterpret.firebaseapp.com",
  projectId: "salinterpret",
  storageBucket: "salinterpret.appspot.com",
  messagingSenderId: "513183016093",
  appId: "1:513183016093:web:3b5a92a4aefac3c6296074",
  measurementId: "G-ZY6B41RWF2", 
};

const firebaseApp = initializeApp(firebaseConfig);


export const firebaseFirestore = getFirestore(firebaseApp); 
export const firebaseStorage = getStorage(firebaseApp);
export const imageDb = getStorage(firebaseApp);

export default firebaseApp;
