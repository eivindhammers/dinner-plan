import { type FirebaseApp, initializeApp } from 'firebase/app'
import { type Firestore, getFirestore } from 'firebase/firestore'
import { type Auth, getAuth } from 'firebase/auth'

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
}

// Check if Firebase is configured (before attempting init)
export const isFirebaseConfigured = (): boolean => {
  return !!(
    firebaseConfig.apiKey &&
    firebaseConfig.projectId &&
    firebaseConfig.appId
  )
}

// Initialize Firebase only if configured — prevents module-level crash
let app: FirebaseApp | null = null
let db: Firestore | null = null
let auth: Auth | null = null

if (isFirebaseConfigured()) {
  try {
    app = initializeApp(firebaseConfig)
    db = getFirestore(app)
    auth = getAuth(app)
  } catch (error) {
    console.error('Firebase initialization failed:', error)
  }
}

export { db, auth }
