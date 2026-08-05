import { create } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { UserProfile } from '../types';
import { Colors } from '../theme/colors';

const KEY = 'userProfile';

const DEFAULT: UserProfile = {
  name: '',
  avatarUri: null,
  avatarEmoji: '🎮',
  color: Colors.primary,
  createdAt: Date.now(),
};

interface ProfileStore {
  profile: UserProfile;
  isLoaded: boolean;
  loadProfile: () => Promise<void>;
  updateProfile: (data: Partial<UserProfile>) => Promise<void>;
  clearProfile: () => Promise<void>;
}

export const useProfileStore = create<ProfileStore>((set, get) => ({
  profile: DEFAULT,
  isLoaded: false,

  loadProfile: async () => {
    try {
      const raw = await AsyncStorage.getItem(KEY);
      if (raw) {
        set({ profile: { ...DEFAULT, ...JSON.parse(raw) }, isLoaded: true });
      } else {
        set({ isLoaded: true });
      }
    } catch {
      set({ isLoaded: true });
    }
  },

  updateProfile: async (data) => {
    const updated = { ...get().profile, ...data };
    set({ profile: updated });
    await AsyncStorage.setItem(KEY, JSON.stringify(updated));
  },

  clearProfile: async () => {
    set({ profile: DEFAULT });
    await AsyncStorage.removeItem(KEY);
  },
}));
