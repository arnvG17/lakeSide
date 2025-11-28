// Import the functions you need from the SDKs you need
import { initializeApp } from "firebase/app";
import { getAnalytics } from "firebase/analytics";
// TODO: Add SDKs for Firebase products that you want to use
// https://firebase.google.com/docs/web/setup#available-libraries

// Your web app's Firebase configuration
// For Firebase JS SDK v7.20.0 and later, measurementId is optional
const firebaseConfig = {
  apiKey: "AIzaSyCK0gn6W8AhPxGS7zyQcWKaHHgBa8tqTrg",
  authDomain: "orgmart-76c5f.firebaseapp.com",
  projectId: "orgmart-76c5f",
  storageBucket: "orgmart-76c5f.firebasestorage.app",
  messagingSenderId: "624230778470",
  appId: "1:624230778470:web:cbc99568df8c358c2bcfa7",
  measurementId: "G-KM7WQEZ4ZF"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const analytics = getAnalytics(app);