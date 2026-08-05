import { create } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { UserStats, GameResult, CategoryId } from '../types';

interface AppStore {
  language: 'ar' | 'en';
  soundEnabled: boolean;
  vibrationEnabled: boolean;
  stats: UserStats;
  recentPlayers: string[];

  setLanguage: (lang: 'ar' | 'en') => void;
  setSoundEnabled: (v: boolean) => void;
  setVibrationEnabled: (v: boolean) => void;
  addGameResult: (result: GameResult) => void;
  addRecentPlayer: (name: string) => void;
  loadAppData: () => Promise<void>;
  clearAllData: () => Promise<void>;
}

const defaultStats: UserStats = {
  totalGames: 0,
  totalQuestions: 0,
  correctAnswers: 0,
  bestScore: 0,
  longestStreak: 0,
  avgAnswerTime: 0,
  strongestCategory: null,
  weakestCategory: null,
  mostWins: '',
  recentGames: [],
  categoryStats: {} as Record<CategoryId, { correct: number; total: number }>,
};

export const useAppStore = create<AppStore>((set, get) => ({
  language: 'ar',
  soundEnabled: true,
  vibrationEnabled: true,
  stats: defaultStats,
  recentPlayers: [],

  setLanguage: async (lang) => {
    set({ language: lang });
    await AsyncStorage.setItem('language', lang);
  },

  setSoundEnabled: async (v) => {
    set({ soundEnabled: v });
    await AsyncStorage.setItem('soundEnabled', String(v));
  },

  setVibrationEnabled: async (v) => {
    set({ vibrationEnabled: v });
    await AsyncStorage.setItem('vibrationEnabled', String(v));
  },

  addGameResult: async (result) => {
    const { stats } = get();
    const maxScore = result.players.reduce((m, p) => Math.max(m, p.score), 0);
    const winner = result.players.find(p => p.score === maxScore);

    const updatedStats: UserStats = {
      ...stats,
      totalGames: stats.totalGames + 1,
      totalQuestions: stats.totalQuestions + result.totalQuestions,
      correctAnswers: stats.correctAnswers + result.players.reduce((s, p) => s + p.correctAnswers, 0),
      bestScore: Math.max(stats.bestScore, maxScore),
      mostWins: winner?.name || stats.mostWins,
      recentGames: [result, ...stats.recentGames].slice(0, 20),
    };

    set({ stats: updatedStats });
    await AsyncStorage.setItem('userStats', JSON.stringify(updatedStats));
  },

  addRecentPlayer: async (name) => {
    const { recentPlayers } = get();
    const updated = [name, ...recentPlayers.filter(n => n !== name)].slice(0, 12);
    set({ recentPlayers: updated });
    await AsyncStorage.setItem('recentPlayers', JSON.stringify(updated));
  },

  loadAppData: async () => {
    try {
      const [lang, sound, vibration, statsRaw, playersRaw] = await Promise.all([
        AsyncStorage.getItem('language'),
        AsyncStorage.getItem('soundEnabled'),
        AsyncStorage.getItem('vibrationEnabled'),
        AsyncStorage.getItem('userStats'),
        AsyncStorage.getItem('recentPlayers'),
      ]);

      set({
        language: (lang as 'ar' | 'en') || 'ar',
        soundEnabled: sound !== 'false',
        vibrationEnabled: vibration !== 'false',
        stats: statsRaw ? JSON.parse(statsRaw) : defaultStats,
        recentPlayers: playersRaw ? JSON.parse(playersRaw) : [],
      });
    } catch {}
  },

  clearAllData: async () => {
    const keys = ['language', 'soundEnabled', 'vibrationEnabled', 'userStats', 'recentPlayers', 'savedGame', 'themeMode'];
    for (const key of keys) {
      await AsyncStorage.removeItem(key);
    }
    set({ stats: defaultStats, recentPlayers: [] });
  },
}));
