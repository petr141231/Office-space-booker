import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyDjY0tVaoA2gd6yy_3-a_EWFSYjLKG4Ll0",
  authDomain: "://firebaseapp.com",
  projectId: "office-booker-f7b5a",
  storageBucket: "office-booker-f7b5a.firebasestorage.app",
  messagingSenderId: "860056755800",
  appId: "1:860056755800:web:8878eb541f0eee3bbf742d",
  measurementId: "G-Y7HM35H584"
};

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);
