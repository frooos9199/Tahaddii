import { createAsyncStorage } from '@react-native-async-storage/async-storage';
import { FirebaseApp, getApp, getApps, initializeApp } from 'firebase/app';
import { Auth, getReactNativePersistence, initializeAuth } from 'firebase/auth';
import { Firestore, getFirestore, initializeFirestore } from 'firebase/firestore';
import { Functions, getFunctions } from 'firebase/functions';
import { Database, getDatabase } from 'firebase/database';
import { FirebaseStorage, getStorage } from 'firebase/storage';

//فراس ديربالك ترفع هذا الملف في قيت هاب  او اي مكان اخر
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

const firebaseApp: FirebaseApp = getApps().length ? getApp() : initializeApp(firebaseConfig);
let firestoreInstance: Firestore;
try {
  firestoreInstance = initializeFirestore(firebaseApp, {
    ignoreUndefinedProperties: true,
  });
} catch {
  firestoreInstance = getFirestore(firebaseApp);
}

const authInstance: Auth = initializeAuth(firebaseApp, {
  persistence: getReactNativePersistence(createAsyncStorage('tahaddi-firebase-auth')),
});

export const getFirebaseAppInstance = (): FirebaseApp => firebaseApp;

export const getFirebaseAuth = (): Auth => authInstance;

export const getFirebaseDb = (): Firestore => firestoreInstance;

export const getFirebaseRealtimeDb = (): Database => getDatabase(getFirebaseAppInstance());

export const getFirebaseFunctions = (): Functions => getFunctions(getFirebaseAppInstance(), 'us-central1');

export const getFirebaseStorage = (): FirebaseStorage => getStorage(getFirebaseAppInstance());
