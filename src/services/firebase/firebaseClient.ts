import { FirebaseApp, getApp, getApps, initializeApp } from 'firebase/app';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Auth, Persistence, getAuth, initializeAuth } from 'firebase/auth';
import { Firestore, getFirestore, initializeFirestore } from 'firebase/firestore';
import { Functions, getFunctions } from 'firebase/functions';
import { Database, getDatabase } from 'firebase/database';
import { FirebaseStorage, getStorage } from 'firebase/storage';

const { getReactNativePersistence } = require('@firebase/auth/dist/rn/index.js') as {
  getReactNativePersistence: (storage: typeof AsyncStorage) => Persistence;
};

// ⚠️ لا ترفع هذا الملف على GitHub
const firebaseConfig = {
  apiKey: 'AIzaSyC0Hcollocb_GErLjJSjluM6DiiuYYg42E',
  authDomain: 'tahaddi-77a5d.firebaseapp.com',
  projectId: 'tahaddi-77a5d',
  databaseURL: 'https://tahaddi-77a5d-default-rtdb.asia-southeast1.firebasedatabase.app',
  storageBucket: 'tahaddi-77a5d.firebasestorage.app',
  messagingSenderId: '611215576327',
  appId: '1:611215576327:web:4aaa75e31b38864de8c9a2',
};

const REQUIRED_KEYS: Array<keyof typeof firebaseConfig> = [
  'apiKey', 'authDomain', 'projectId',
  'storageBucket', 'messagingSenderId', 'appId',
];

export const isFirebaseConfigured = () =>
  REQUIRED_KEYS.every(key => (firebaseConfig[key] ?? '').trim().length > 0);

// Initialize the app eagerly so auth is the very first SDK consumer — prevents the
// "without AsyncStorage" warning that fires when getAuth() runs before initializeAuth().
const firebaseApp: FirebaseApp = getApps().length ? getApp() : initializeApp(firebaseConfig);
let firestoreInstance: Firestore;
try {
  firestoreInstance = initializeFirestore(firebaseApp, {
    ignoreUndefinedProperties: true,
  });
} catch {
  firestoreInstance = getFirestore(firebaseApp);
}

// initializeAuth with persistence; gracefully handles hot-reload where auth is already registered.
let authInstance: Auth;
try {
  authInstance = initializeAuth(firebaseApp, {
    persistence: getReactNativePersistence(AsyncStorage),
  });
} catch {
  authInstance = getAuth(firebaseApp);
}

export const getFirebaseAppInstance = (): FirebaseApp => firebaseApp;

export const getFirebaseAuth = (): Auth => authInstance;

export const getFirebaseDb = (): Firestore => firestoreInstance;

export const getFirebaseRealtimeDb = (): Database => getDatabase(getFirebaseAppInstance());

export const getFirebaseFunctions = (): Functions => getFunctions(getFirebaseAppInstance(), 'us-central1');

export const getFirebaseStorage = (): FirebaseStorage => getStorage(getFirebaseAppInstance());
