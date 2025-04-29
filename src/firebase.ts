import { initializeApp } from "firebase/app";
import { getAnalytics } from "firebase/analytics";
import { getAuth } from "firebase/auth";

const firebaseConfig = {
    apiKey: "AIzaSyBwlqZVctCQhfKhKr6nIy3iBRHFdQMitdM",
    authDomain: "dtr-for-als.firebaseapp.com",
    projectId: "dtr-for-als",
    storageBucket: "dtr-for-als.firebasestorage.app",
    messagingSenderId: "739537628398",
    appId: "1:739537628398:web:c96c46119f1b513e2cd7ff",
    measurementId: "G-3BWZ1R5FFK"
  };

const app = initializeApp(firebaseConfig);
const analytics = getAnalytics(app);
const auth = getAuth(app);

export {app, analytics, auth};
