import { Platform, Vibration } from 'react-native';

export const generateId = (): string =>
  Math.random().toString(36).substring(2) + Date.now().toString(36);

export const shuffle = <T>(arr: T[]): T[] =>
  [...arr].sort(() => Math.random() - 0.5);

export const formatTime = (seconds: number): string => {
  if (seconds < 60) return `${seconds}s`;
  return `${Math.floor(seconds / 60)}m ${seconds % 60}s`;
};

export const vibrate = (pattern?: number | number[]) => {
  if (Platform.OS === 'android') {
    Vibration.vibrate(pattern || 100);
  }
};

export const clamp = (val: number, min: number, max: number) =>
  Math.min(Math.max(val, min), max);

export const getWinner = <T extends { score: number }>(items: T[]): T | null => {
  if (!items.length) return null;
  return items.reduce((a, b) => (a.score >= b.score ? a : b));
};

export const calcProgressivePoints = (index: number, total: number): 'easy' | 'medium' | 'hard' => {
  const third = Math.floor(total / 3);
  if (index < third) return 'easy';
  if (index < third * 2) return 'medium';
  return 'hard';
};
