import { create } from 'zustand';
import { User, onAuthStateChanged } from 'firebase/auth';
import { AppUserRecord } from '../types';
import {
  ensureUserDocument,
  requestPasswordReset,
  signInWithEmail,
  signOutCurrentUser,
  signUpWithEmail,
} from '../services/auth/authService';
import { getFirebaseAuth, isFirebaseConfigured } from '../services/firebase/firebaseClient';
import { useProfileStore } from './profileStore';
import { mergeLocalHistoryWithFirebase, syncQuestionHistory } from '../services/questions/questionHistoryService';
import i18n from '../localization/i18n';
import { getAuthErrorTranslationKey } from '../utils/authError';

const getAuthErrorMessage = (error: unknown) => i18n.t(getAuthErrorTranslationKey(error));

const syncProfileFromUserRecord = async (userRecord: AppUserRecord) => {
  const profilePatch = {
    ...(userRecord.displayName ? { name: userRecord.displayName } : {}),
    ...(userRecord.avatarUri !== undefined ? { avatarUri: userRecord.avatarUri } : {}),
    ...(userRecord.avatarEmoji ? { avatarEmoji: userRecord.avatarEmoji } : {}),
    ...(userRecord.color ? { color: userRecord.color } : {}),
  };

  if (Object.keys(profilePatch).length) {
    await useProfileStore.getState().updateProfile(profilePatch);
  }
};

interface AuthStore {
  user: User | null;
  userRecord: AppUserRecord | null;
  isReady: boolean;
  loading: boolean;
  error: string | null;
  initAuth: () => void;
  clearError: () => void;
  refreshUserRecord: () => Promise<void>;
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, password: string, displayName?: string) => Promise<void>;
  resetPassword: (email: string) => Promise<boolean>;
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
      if (user?.isAnonymous) {
        await signOutCurrentUser().catch(() => {});
        set({ user: null, userRecord: null, isReady: true, loading: false, error: null });
        return;
      }

      if (!user) {
        set({ user: null, userRecord: null, isReady: true, loading: false });
        return;
      }

      try {
        const userRecord = await ensureUserDocument(user);
        await syncProfileFromUserRecord(userRecord);
        if (!user.isAnonymous) {
          await mergeLocalHistoryWithFirebase(user.uid).catch(error => {
            console.warn('Failed to merge question history', error);
          });
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

  login: async (email, password) => {
    set({ loading: true, error: null });
    try {
      const user = await signInWithEmail({ email, password });
      const userRecord = await ensureUserDocument(user);
      await syncProfileFromUserRecord(userRecord);
      await mergeLocalHistoryWithFirebase(user.uid).catch(error => {
        console.warn('Failed to merge question history after login', error);
      });
      set({ user, userRecord, loading: false, isReady: true });
    } catch (error) {
      set({ loading: false, error: getAuthErrorMessage(error) });
    }
  },

  register: async (email, password, displayName) => {
    set({ loading: true, error: null });
    try {
      const user = await signUpWithEmail({ email, password, displayName });
      const userRecord = await ensureUserDocument(user, displayName);
      await syncProfileFromUserRecord(userRecord);
      await mergeLocalHistoryWithFirebase(user.uid).catch(error => {
        console.warn('Failed to merge question history after registration', error);
      });
      set({ user, userRecord, loading: false, isReady: true });
    } catch (error) {
      set({ loading: false, error: getAuthErrorMessage(error) });
    }
  },

  resetPassword: async email => {
    set({ loading: true, error: null });
    try {
      await requestPasswordReset(email);
      set({ loading: false });
      return true;
    } catch (error) {
      set({ loading: false, error: getAuthErrorMessage(error) });
      return false;
    }
  },

  logout: async () => {
    set({ loading: true, error: null });
    try {
      const currentUser = get().user;
      if (currentUser && !currentUser.isAnonymous) {
        await syncQuestionHistory(currentUser.uid).catch(error => {
          console.warn('Failed to sync question history before logout', error);
        });
      }
      await signOutCurrentUser();
      set({ user: null, userRecord: null, loading: false });
    } catch (error) {
      set({ loading: false, error: getAuthErrorMessage(error) });
    }
  },
}));