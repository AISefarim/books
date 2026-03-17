import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";
import { getAuth } from "firebase/auth";
import { getStorage } from "firebase/storage";

const firebaseConfig = {
  apiKey: "AIzaSyDxPMAW_pa1GBggo6swF348it_bdu71kZQ",
  authDomain: "ai-sefarim.firebaseapp.com",
  projectId: "ai-sefarim",
  storageBucket: "ai-sefarim.firebasestorage.app",
  messagingSenderId: "918990822328",
  appId: "1:918990822328:web:a646432e6d6dbb19204d4d"
};

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);
export const auth = getAuth(app);
export const storage = getStorage(app);
