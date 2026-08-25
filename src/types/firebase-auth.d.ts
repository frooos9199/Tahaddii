import type { Persistence } from 'firebase/auth';

// firebase/auth's public type declarations don't include the React Native
// build's exports (getReactNativePersistence exists at runtime via Metro's
// "react-native" package export condition, but isn't in the shared .d.ts).
declare module 'firebase/auth' {
  export function getReactNativePersistence(storage: unknown): Persistence;
}
