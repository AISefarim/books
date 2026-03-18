import { initializeApp } from "firebase/app";
import { getFirestore, doc, getDoc } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyDxPMAW_pa1GBggo6swF348it_bdu71kZQ",
  authDomain: "ai-sefarim.firebaseapp.com",
  projectId: "ai-sefarim",
  storageBucket: "ai-sefarim.firebasestorage.app",
  messagingSenderId: "918990822328",
  appId: "1:918990822328:web:a646432e6d6dbb19204d4d"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

async function run() {
  const docRef = doc(db, 'artifacts', 'ai-sefarim', 'public', 'data', 'sefarim', '_site_settings_');
  const snap = await getDoc(docRef);
  if (snap.exists()) {
    console.log("LOGO_URL=" + snap.data().logoUrl);
  } else {
    console.log("No settings found");
  }
  process.exit(0);
}
run();
