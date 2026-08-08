import { addDoc, collection, doc, getDocs, serverTimestamp, setDoc } from 'firebase/firestore';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { AgeGroup, CategoryId, Difficulty, Question } from '../../types';
import { DIFFICULTY_POINTS } from '../../constants';
import { getFirebaseDb, isFirebaseConfigured } from '../firebase/firebaseClient';

const CUSTOM_QUESTIONS_COLLECTION = 'customQuestions';
const CACHE_STORAGE_KEY = 'customQuestions.cache.v1';
// Custom questions rarely change minute-to-minute; caching for a few minutes
// keeps the "add from admin panel shows up quickly" behaviour while avoiding
// a full collection read on every screen navigation (Home, Category, Difficulty,
// GameSetup, OnlineLobby previously each triggered their own full fetch).
const CACHE_TTL_MS = 5 * 60 * 1000;

let memoryCache: { fetchedAtMs: number; questions: Question[] } | null = null;
let inFlightFetch: Promise<Question[]> | null = null;

export interface CustomQuestionInput {
  id?: string;
  categoryId: CategoryId;
  linkedCategoryIds?: CategoryId[];
  difficulty: Difficulty;
  questionAr: string;
  answersAr: string[];
  correctAnswerIndex: number;
  ageGroups?: AgeGroup[];
  questionEn?: string;
  answersEn?: string[];
  explanationAr?: string;
  imageUrl?: string;
  revealImageUrl?: string;
  revealMode?: 'none' | 'blur';
  blurAmount?: number;
}

const toQuestion = (questionId: string, payload: any): Question => {
  const answersAr = Array.isArray(payload.answersAr) ? payload.answersAr : [];
  const answersEn = Array.isArray(payload.answersEn) && payload.answersEn.length ? payload.answersEn : answersAr;
  const correctAnswerIndex = payload.correctAnswerIndex ?? 0;
  const difficulty = payload.difficulty as Difficulty;

  return {
    id: questionId,
    type: payload.type || 'multiple_choice',
    categoryId: payload.categoryId as CategoryId,
    linkedCategoryIds: Array.isArray(payload.linkedCategoryIds)
      ? payload.linkedCategoryIds.map(String).filter((categoryId: string) => categoryId && categoryId !== payload.categoryId)
      : [],
    ageGroups: Array.isArray(payload.ageGroups) && payload.ageGroups.length
      ? payload.ageGroups
      : ['kids5', 'kids8', 'kids11', 'teens', 'adults', 'family'],
    difficulty,
    questionAr: payload.questionAr ?? '',
    questionEn: payload.questionEn || payload.questionAr || '',
    answersAr,
    answersEn,
    correctAnswerIndex,
    correctAnswerAr: payload.correctAnswerAr ?? answersAr[correctAnswerIndex] ?? '',
    correctAnswerEn: payload.correctAnswerEn ?? answersEn[correctAnswerIndex] ?? answersAr[correctAnswerIndex] ?? '',
    explanationAr: payload.explanationAr || undefined,
    explanationEn: payload.explanationEn || undefined,
    imageUrl: String(payload.imageUrl ?? '').trim() || undefined,
    revealImageUrl: String(payload.revealImageUrl ?? '').trim() || undefined,
    thumbnailUrl: String(payload.thumbnailUrl ?? '').trim() || undefined,
    videoUrl: String(payload.videoUrl ?? '').trim() || undefined,
    mediaType: payload.mediaType === 'video'
      ? 'video'
      : String(payload.imageUrl ?? payload.revealImageUrl ?? payload.thumbnailUrl ?? '').trim()
        ? 'image'
        : undefined,
    revealMode: payload.revealMode || undefined,
    blurAmount: Number(payload.blurAmount ?? 18),
    createdAtMs: Number(payload.createdAtMs ?? payload.updatedAtMs ?? 0) || undefined,
    points: Number(payload.points ?? DIFFICULTY_POINTS[difficulty] ?? DIFFICULTY_POINTS.easy),
    isKidsSafe: payload.isKidsSafe ?? true,
    isActive: payload.isActive ?? true,
    isPremium: payload.isPremium ?? false,
    source: 'admin',
  };
};

const readPersistedCache = async (): Promise<{ fetchedAtMs: number; questions: Question[] } | null> => {
  try {
    const raw = await AsyncStorage.getItem(CACHE_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed.fetchedAtMs !== 'number' || !Array.isArray(parsed.questions)) return null;
    return parsed;
  } catch {
    return null;
  }
};

const writePersistedCache = async (cache: { fetchedAtMs: number; questions: Question[] }) => {
  try {
    await AsyncStorage.setItem(CACHE_STORAGE_KEY, JSON.stringify(cache));
  } catch {
    // Ignore persistence failures — memory cache still applies for this session.
  }
};

const fetchCustomQuestionsFromFirestore = async (): Promise<Question[]> => {
  const db = getFirebaseDb();
  const snapshot = await getDocs(collection(db, CUSTOM_QUESTIONS_COLLECTION));
  return snapshot.docs
    .map(questionDoc => ({ id: questionDoc.id, data: questionDoc.data() }))
    .sort((left, right) => Number(right.data.updatedAtMs ?? right.data.createdAtMs ?? 0) - Number(left.data.updatedAtMs ?? left.data.createdAtMs ?? 0))
    .map(questionDoc => toQuestion(questionDoc.id, questionDoc.data));
};

/**
 * Returns admin-added custom questions, backed by an in-memory + persisted
 * cache (TTL-based) to avoid re-reading the full `customQuestions` collection
 * from Firestore on every screen (Home, Category, Difficulty, GameSetup,
 * OnlineLobby, etc. previously each triggered their own independent read).
 * Pass `forceRefresh: true` to bypass the cache (e.g. after the admin edits
 * a question from inside the same running session).
 */
export const listCustomQuestions = async ({ forceRefresh = false }: { forceRefresh?: boolean } = {}): Promise<Question[]> => {
  if (!isFirebaseConfigured()) {
    return [];
  }

  const now = Date.now();

  if (!forceRefresh && memoryCache && now - memoryCache.fetchedAtMs < CACHE_TTL_MS) {
    return memoryCache.questions;
  }

  if (!forceRefresh && !memoryCache) {
    const persisted = await readPersistedCache();
    if (persisted && now - persisted.fetchedAtMs < CACHE_TTL_MS) {
      memoryCache = persisted;
      return persisted.questions;
    }
  }

  if (!forceRefresh && inFlightFetch) {
    return inFlightFetch;
  }

  const fetchPromise = (async () => {
    try {
      const questions = await fetchCustomQuestionsFromFirestore();
      const cache = { fetchedAtMs: Date.now(), questions };
      memoryCache = cache;
      void writePersistedCache(cache);
      return questions;
    } finally {
      inFlightFetch = null;
    }
  })();

  inFlightFetch = fetchPromise;
  return fetchPromise;
};

export const invalidateCustomQuestionsCache = () => {
  memoryCache = null;
  void AsyncStorage.removeItem(CACHE_STORAGE_KEY).catch(() => {});
};

export const addCustomQuestion = async (input: CustomQuestionInput) => {
  const questionAr = input.questionAr.trim();
  const answersAr = input.answersAr.map(answer => answer.trim()).filter(Boolean);
  const correctAnswerIndex = Number.isInteger(input.correctAnswerIndex) ? input.correctAnswerIndex : 0;

  if (!questionAr) {
    throw new Error('اكتب نص السؤال');
  }

  if (answersAr.length < 2) {
    throw new Error('أضف اختيارين على الأقل');
  }

  if (correctAnswerIndex < 0 || correctAnswerIndex >= answersAr.length) {
    throw new Error('اختر الإجابة الصحيحة');
  }

  const answersEn = input.answersEn?.map(answer => answer.trim()).filter(Boolean);
  const db = getFirebaseDb();
  const now = Date.now();
  const revealMode: 'none' | 'blur' = input.revealMode === 'blur' ? 'blur' : 'none';
  const blurAmount = revealMode === 'blur' ? Math.max(1, Number(input.blurAmount ?? 18)) : 0;

  const payload = {
    categoryId: input.categoryId,
    linkedCategoryIds: [...new Set((input.linkedCategoryIds ?? []).filter(categoryId => categoryId && categoryId !== input.categoryId))],
    difficulty: input.difficulty,
    questionAr,
    questionEn: input.questionEn?.trim() || questionAr,
    answersAr,
    answersEn: answersEn?.length === answersAr.length ? answersEn : answersAr,
    correctAnswerIndex,
    ageGroups: input.ageGroups?.length ? input.ageGroups : ['kids5', 'kids8', 'kids11', 'teens', 'adults', 'family'],
    explanationAr: input.explanationAr?.trim() || null,
    imageUrl: input.imageUrl?.trim() || '',
    revealImageUrl: input.revealImageUrl?.trim() || '',
    mediaType: input.imageUrl?.trim() || input.revealImageUrl?.trim() ? 'image' : '',
    revealMode,
    blurAmount,
    isKidsSafe: true,
    isActive: true,
    createdAtMs: now,
    updatedAtMs: now,
    createdAt: serverTimestamp(),
  };

  if (input.id) {
    const cleanPayload = Object.fromEntries(Object.entries(payload).filter(([, value]) => value !== undefined));
    await setDoc(doc(db, CUSTOM_QUESTIONS_COLLECTION, input.id), cleanPayload, { merge: true });
    invalidateCustomQuestionsCache();
    return input.id;
  }

  const docRef = await addDoc(collection(db, CUSTOM_QUESTIONS_COLLECTION), payload);

  invalidateCustomQuestionsCache();
  return docRef.id;
};