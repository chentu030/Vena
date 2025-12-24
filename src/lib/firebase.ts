import { initializeApp, getApps, getApp } from "firebase/app";
import { getAuth, GoogleAuthProvider } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { getStorage } from "firebase/storage";

const firebaseConfig = {
    apiKey: "AIzaSyDjqAwKC2bhn8oLztXU3BPXzKJat2_1shk",
    authDomain: "scopus-a.firebaseapp.com",
    projectId: "scopus-a",
    storageBucket: "scopus-a.firebasestorage.app",
    messagingSenderId: "106839942272",
    appId: "1:106839942272:web:32fa88b7473c7d16aeb265",
    measurementId: "G-S0XVZP5XV0"
};

// Initialize Firebase (Singleton pattern)
const app = !getApps().length ? initializeApp(firebaseConfig) : getApp();
const auth = getAuth(app);
const db = getFirestore(app);
const storage = getStorage(app);
const googleProvider = new GoogleAuthProvider();

export { app, auth, db, storage, googleProvider };
