import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';

// Your web app's Firebase configuration
const firebaseConfig = {
    apiKey: "AIzaSyA_8yhhVG5rqx0dzmJbJB3lc84ghJD4_Q8",
    authDomain: "total-comp-calculator-f36a0.firebaseapp.com",
    projectId: "total-comp-calculator-f36a0",
    storageBucket: "total-comp-calculator-f36a0.firebasestorage.app",
    messagingSenderId: "71189163333",
    appId: "1:71189163333:web:47e65d813cc06e7f3ee22c",
    measurementId: "G-VJC95WCVF1"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Initialize Firebase Authentication and get a reference to the service
export const auth = getAuth(app);

// Initialize Cloud Firestore and get a reference to the service
export const db = getFirestore(app);

export default app; 