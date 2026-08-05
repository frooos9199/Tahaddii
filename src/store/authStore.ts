import { create } from 'zustand';
import { User, onAuthStateChanged } from 'firebase/auth';
import { AppUserRecord } from '../types';
import {
  ensureUserDocument,
  signInAsGuest,
  signInWithEmail,
  signOutCurrentUser,
  signUpWithEmail,
} from '../services/auth/authService';
import { getFirebaseAuth, isFirebaseConfigured } from '../services/firebase/firebaseClient';
import { useProfileStore } from './profileStore';

interface AuthStore {
  user: User | null;
  userRecord: AppUserRecord | null;
  isReady: boolean;
  loading: boolean;
  error: string | null;
  initAuth: () => void;
  clearError: () => void;
  refreshUserRecord: () => Promise<void>;
  continueAsGuest: (displayName?: string) => Promise<void>;
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, password: string, displayName?: string) => Promise<void>;
  logout: () => Promise<void>;
}

let authUnsubscribe: (() => void) | null = null;

export const useAuthStore = create<AuthStore>((set, get) => ({
  user: null,
  userRecord: null,
  isReady: false,
  loading: false,
  error: null,

  initAuth: () => {
    if (authUnsubscribe || !isFirebaseConfigured()) {
      if (!isFirebaseConfigured()) {
        set({ isReady: true });
      }
      return;
    }

    const auth = getFirebaseAuth();
    authUnsubscribe = onAuthStateChanged(auth, async user => {
      if (!user) {
        set({ user: null, userRecord: null, isReady: true, loading: false });
        return;
      }

      try {
        const userRecord = await ensureUserDocument(user);
        if (!userRecord.isGuest && userRecord.displayName) {
          await useProfileStore.getState().updateProfile({ name: userRecord.displayName });
        }
        set({ user, userRecord, isReady: true, loading: false, error: null });
      } catch (error) {
        set({
          user,
          userRecord: null,
          isReady: true,
          loading: false,
          error: error instanceof Error ? error.message : 'Failed to load user',
        });
      }
    });
  },

  clearError: () => set({ error: null }),

  refreshUserRecord: async () => {
    const { user } = get();
    if (!user) {
      set({ userRecord: null });
      return;
    }

    const userRecord = await ensureUserDocument(user);
    set({ userRecord });
  },

  continueAsGuest: async (displayName) => {
    set({ loading: true, error: null });
    try {
      const user = await signInAsGuest(displayName);
      const userRecord = await ensureUserDocument(user, displayName);
      set({ user, userRecord, loading: false, isReady: true });
    } catch (error) {
      set({ loading: false, error: error instanceof Error ? error.message : 'Guest sign-in failed' });
    }
  },

  login: async (email, password) => {
    set({ loading: true, error: null });
    try {
      const user = await signInWithEmail({ email, password });
      const userRecord = await ensureUserDocument(user);
      if (userRecord.displayName) {
        await useProfileStore.getState().updateProfile({ name: userRecord.displayName });
      }
      set({ user, userRecord, loading: false, isReady: true });
    } catch (error) {
      set({ loading: false, error: error instanceof Error ? error.message : 'Login failed' });
    }
  },

  register: async (email, password, displayName) => {
    set({ loading: true, error: null });
    try {
      const user = await signUpWithEmail({ email, password, displayName });
      const userRecord = await ensureUserDocument(user, displayName);
      if (userRecord.displayName) {
        await useProfileStore.getState().updateProfile({ name: userRecord.displayName });
      }
      set({ user, userRecord, loading: false, isReady: true });
    } catch (error) {
      set({ loading: false, error: error instanceof Error ? error.message : 'Registration failed' });
    }
  },

  logout: async () => {
    set({ loading: true, error: null });
    try {
      await signOutCurrentUser();
      set({ user: null, userRecord: null, loading: false });
    } catch (error) {
      set({ loading: false, error: error instanceof Error ? error.message : 'Logout failed' });
    }
  },
}));