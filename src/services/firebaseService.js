import { initializeApp } from 'firebase/app';
import { getFirestore } from 'firebase/firestore';
import { getAuth } from 'firebase/auth';
import { firebaseConfig, USE_MOCK_DATA } from './firebase';

let app, db, auth;

if (!USE_MOCK_DATA) {
    app = initializeApp(firebaseConfig);
    db = getFirestore(app);
    auth = getAuth(app);
} else {
    // Mock mode - we'll use local state instead
    console.log('Running in MOCK mode - no Firebase connection');
}

export { db, auth, USE_MOCK_DATA };
