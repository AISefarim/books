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
  storageBucket: "ai-sefarim.appspot.com",
  messagingSenderId: "918990822328",
  appId: "1:918990822328:web:a646432e6d6dbb19204d4d"
};

const firebaseConfig = typeof window !== 'undefined' && window.__firebase_config 
  ? JSON.parse(window.__firebase_config) 
  : fallbackConfig;

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);
export const auth = getAuth(app);
export const storage = getStorage(app);
