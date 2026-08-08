import { ref, remove, set } from 'firebase/database';
import { CategoryId, QuestionType } from '../../types';
import { getFirebaseRealtimeDb } from '../firebase/firebaseClient';

const TV_DISPLAY_SESSIONS_PATH = 'tvDisplaySessions';
const TV_DISPLAY_SESSION_TTL_MS = 6 * 60 * 60 * 1000;
const TV_DISPLAY_DATABASE_URL = 'https://tahaddi-77a5d-default-rtdb.asia-southeast1.firebasedatabase.app';

export type TvDisplayAnswer = {
  text: string;
  isCorrect: boolean;
  isSelected: boolean;
};

export type TvDisplayPlayer = {
  id: string;
  name: string;
  score: number;
  correctAnswers: number;
  wrongAnswers: number;
  color: string;
};

export type TvDisplayState = {
  code: string;
  gameId: string;
  status: 'pairing' | 'playing' | 'revealed' | 'finished';
  syncSource?: string;
  syncVersion?: number;
  language: 'ar' | 'en';
  questionIndex: number;
  totalQuestions: number;
  timeLeft: number | null;
  question: {
    id: string;
    type?: QuestionType;
    categoryId?: CategoryId;
    previousCategoryId?: CategoryId;
    categoryTransitionKey?: string;
    categoryName?: string;
    categoryEmoji?: string;
    text: string;
    points: number;
    imageUrl?: string;
    revealImageUrl?: string;
    thumbnailUrl?: string;
    videoUrl?: string;
    mediaType?: 'image' | 'video';
    revealMode?: 'none' | 'blur' | 'crop' | 'mask';
    blurAmount?: number;
  } | null;
  answers: TvDisplayAnswer[];
  currentPlayer: Pick<TvDisplayPlayer, 'id' | 'name' | 'score' | 'color'> | null;
  players: TvDisplayPlayer[];
  correctAnswer: string;
  explanation: string;
  updatedAtMs: number;
  expiresAtMs: number;
};

const createDisplayCode = () => {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  return Array.from({ length: 5 }, () => alphabet[Math.floor(Math.random() * alphabet.length)]).join('');
};

const getSessionRef = (code: string) => ref(getFirebaseRealtimeDb(), `${TV_DISPLAY_SESSIONS_PATH}/${code}`);
const getSessionRestUrl = (code: string) => `${TV_DISPLAY_DATABASE_URL}/${TV_DISPLAY_SESSIONS_PATH}/${encodeURIComponent(code)}.json`;

const removeUndefinedValues = <T>(value: T): T => {
  if (Array.isArray(value)) {
    return value.map(item => removeUndefinedValues(item)) as T;
  }

  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value).map(([key, entry]) => [key, entry === undefined ? null : removeUndefinedValues(entry)]),
    ) as T;
  }

  return value;
};

export const getTvDisplayUrl = (code: string) => `https://tahaddii.com/tv/?code=${encodeURIComponent(code)}`;

export const createTvDisplaySession = async () => createDisplayCode();

const writeTvDisplaySession = async (code: string, payload: Omit<TvDisplayState, 'updatedAtMs' | 'expiresAtMs'> & Pick<TvDisplayState, 'updatedAtMs' | 'expiresAtMs'>) => {
  const cleanPayload = removeUndefinedValues(payload);
  const sdkWrite = set(getSessionRef(code), cleanPayload);
  const restWrite = fetch(getSessionRestUrl(code), {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(cleanPayload),
  }).then(response => {
    if (!response.ok) {
      throw new Error(`TV REST sync failed: ${response.status}`);
    }
  });

  const results = await Promise.allSettled([sdkWrite, restWrite]);
  if (results.every(result => result.status === 'rejected')) {
    const firstError = results[0].status === 'rejected' ? results[0].reason : results[1].status === 'rejected' ? results[1].reason : undefined;
    throw firstError instanceof Error ? firstError : new Error('TV display sync failed');
  }
};

export const pairTvDisplaySession = async (code: string, language: 'ar' | 'en') => {
  const now = Date.now();
  await writeTvDisplaySession(code, {
    code,
    gameId: '',
    status: 'pairing',
    language,
    questionIndex: 0,
    totalQuestions: 0,
    timeLeft: null,
    question: null,
    answers: [],
    currentPlayer: null,
    players: [],
    correctAnswer: '',
    explanation: '',
    updatedAtMs: now,
    expiresAtMs: now + TV_DISPLAY_SESSION_TTL_MS,
  });
};

export const updateTvDisplaySession = async (code: string, state: Omit<TvDisplayState, 'code' | 'updatedAtMs' | 'expiresAtMs'>) => {
  const now = Date.now();
  await writeTvDisplaySession(code, {
    ...state,
    code,
    syncVersion: now,
    updatedAtMs: now,
    expiresAtMs: now + TV_DISPLAY_SESSION_TTL_MS,
  });
};

export const endTvDisplaySession = async (code: string) => {
  await remove(getSessionRef(code));
};
