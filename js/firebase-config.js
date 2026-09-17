import { initializeApp, getApp, getApps } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";

export const firebaseConfig = {
    apiKey: "AIzaSyCzEXDrGHSB9IZpZHZIorRcziJCDzNd60Y",
    authDomain: "cararide-58e30.firebaseapp.com",
    projectId: "cararide-58e30",
    storageBucket: "cararide-58e30.firebasestorage.app",
    messagingSenderId: "316214448661",
    appId: "1:316214448661:web:f1d11af589e5deb3ed741c"
};

const app = getApps().length ? getApp() : initializeApp(firebaseConfig);
const provisionApp = getApps().some((a) => a.name === "provision")
    ? getApp("provision")
    : initializeApp(firebaseConfig, "provision");

export const db = getFirestore(app);
export const auth = getAuth(app);
export const provisionAuth = getAuth(provisionApp);
