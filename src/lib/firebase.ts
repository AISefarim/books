import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";
import { getAuth } from "firebase/auth";
import { getStorage } from "firebase/storage";

declare global {
  var __firebase_config: string | undefined;
}

const fallbackConfig = {
  apiKey: "AIzaSyDxPMAW_pa1GBggo6swF348it_bdu71kZQ",
  authDomain: "ai-sefarim.firebaseapp.com",
  projectId: "ai-sefarim",
  storageBucket: "ai-sefarim.firebasestorage.app",
  messagingSenderId: "918990822328",
  appId: "1:918990822328:web:a646432e6d6dbb19204d4d"
};

const firebaseConfig = typeof window !== 'undefined' && window.__firebase_config 
  ? JSON.parse(window.__firebase_config) 
  : fallbackConfig;

// Sign-in runs on our own domain (aisefarim.com/__/auth/*, proxied to Firebase in vercel.json). With the default
// firebaseapp.com domain, iPhone Safari and in-app browsers block the sign-in state ("missing initial state").
if (typeof window !== 'undefined' && /(^|\.)aisefarim\.com$/.test(window.location.hostname)) {
  firebaseConfig.authDomain = "aisefarim.com"; // www is the same site, so one sign-in address serves both
}

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);
export const auth = getAuth(app);
export const storage = getStorage(app);
