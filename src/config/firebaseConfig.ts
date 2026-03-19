/**
 * Configuration Firebase — initialisation via variables EXPO_PUBLIC_*.
 * Guard contre double initialisation (getApps().length).
 * Utilisé pour Firebase JS SDK (Analytics, etc.) — FCM natif via @react-native-firebase/messaging.
 *
 * PRÉREQUIS : npx expo install firebase
 */
import { getApps, initializeApp, type FirebaseApp } from 'firebase/app';
import { ENV } from './env';

const firebaseConfig = {
  apiKey: ENV.FIREBASE_API_KEY,
  authDomain: ENV.FIREBASE_AUTH_DOMAIN,
  projectId: ENV.FIREBASE_PROJECT_ID,
  storageBucket: ENV.FIREBASE_STORAGE_BUCKET,
  messagingSenderId: ENV.FIREBASE_SENDER_ID,
  appId: ENV.FIREBASE_APP_ID,
};

/**
 * Initialise Firebase une seule fois.
 * Retourne l'instance existante si déjà initialisée.
 */
export function getFirebaseApp(): FirebaseApp | null {
  if (getApps().length > 0) {
    return getApps()[0] as FirebaseApp;
  }
  if (!ENV.FIREBASE_API_KEY || !ENV.FIREBASE_PROJECT_ID) {
    return null;
  }
  return initializeApp(firebaseConfig);
}

/**
 * Appel au démarrage pour initialiser Firebase si config présente.
 */
export function initFirebase(): FirebaseApp | null {
  return getFirebaseApp();
}
