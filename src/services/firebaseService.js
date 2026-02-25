import { initializeApp } from 'firebase/app';
import { getFirestore } from 'firebase/firestore';
import { getAuth, GoogleAuthProvider, signInWithPopup, signOut } from 'firebase/auth';
import { firebaseConfig, USE_MOCK_DATA } from '../config/firebase';

let app, db, auth, googleProvider;

if (!USE_MOCK_DATA) {
    app = initializeApp(firebaseConfig);
    db = getFirestore(app);
    auth = getAuth(app);
    googleProvider = new GoogleAuthProvider();
} else {
    // Mock mode - we'll use local state instead
    console.log('Running in MOCK mode - no Firebase connection');
}

export { db, auth, googleProvider, signInWithPopup, signOut, USE_MOCK_DATA };
