import { addDoc, collection, doc, getDocs, query, serverTimestamp, setDoc, where } from 'firebase/firestore';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { AgeGroup, CategoryId, Difficulty, Question } from '../../types';
import { DIFFICULTY_POINTS } from '../../constants';
import { getFirebaseDb, isFirebaseConfigured } from '../firebase/firebaseClient';

const CUSTOM_QUESTIONS_COLLECTION = 'customQuestions';
const CACHE_STORAGE_KEY = 'customQuestions.cache.v2';
// Local-first strategy: after the first full download, we no longer re-read the
// whole `customQuestions` collection on every screen visit. Instead we keep the
// full question set cached on-device (AsyncStorage) forever, and only ask
// Firestore for documents changed since the last sync ("delta sync") — this is
// a near-free read on days nothing changed, since it returns an empty snapshot.
// New/edited questions from the admin panel still show up automatically the
// next time the app checks (see SYNC_CHECK_INTERVAL_MS below), without needing
// an app store update.
//
// Trade-off: the admin panel hard-deletes questions (no soft-delete flag), so a
// delta sync alone cannot detect deletions. We reconcile that with a full
// re-download at most once every FULL_RESYNC_INTERVAL_MS — meaning a deleted
// question can keep appearing locally for up to that long in the worst case.
const SYNC_CHECK_INTERVAL_MS = 2 * 60 * 1000; // how often we bother checking for changes at all
const FULL_RESYNC_INTERVAL_MS = 24 * 60 * 60 * 1000; // safety net to catch deletions

interface PersistedCache {
  questionsById: Record<string, Question>;
  lastSyncMs: number; // last time we checked Firestore for anything new/changed
  lastFullSyncMs: number; // last time we did a full collection re-download
}

let memoryCache: PersistedCache | null = null;
let inFlightFetch: Promise<Question[]> | null = null;

const cacheToOrderedQuestions = (cache: PersistedCache): Question[] =>
  Object.values(cache.questionsById).sort(
    (left, right) => Number(right.updatedAtMs ?? right.createdAtMs ?? 0) - Number(left.updatedAtMs ?? left.createdAtMs ?? 0),
  );

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
    updatedAtMs: Number(payload.updatedAtMs ?? payload.createdAtMs ?? 0) || undefined,
    points: Number(payload.points ?? DIFFICULTY_POINTS[difficulty] ?? DIFFICULTY_POINTS.easy),
    isKidsSafe: payload.isKidsSafe ?? true,
    isActive: payload.isActive ?? true,
    isPremium: payload.isPremium ?? false,
    source: 'admin',
  };
};

const readPersistedCache = async (): Promise<PersistedCache | null> => {
  try {
    const raw = await AsyncStorage.getItem(CACHE_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed.lastSyncMs !== 'number' || !parsed.questionsById || typeof parsed.questionsById !== 'object') return null;
    return {
      questionsById: parsed.questionsById,
      lastSyncMs: parsed.lastSyncMs,
      lastFullSyncMs: typeof parsed.lastFullSyncMs === 'number' ? parsed.lastFullSyncMs : parsed.lastSyncMs,
    };
  } catch {
    return null;
  }
};

const writePersistedCache = async (cache: PersistedCache) => {
  try {
    await AsyncStorage.setItem(CACHE_STORAGE_KEY, JSON.stringify(cache));
  } catch {
    // Ignore persistence failures — memory cache still applies for this session.
  }
};

/**
 * Full collection read — only used for the very first download on a device,
 * or the periodic safety-net resync that catches admin-side deletions.
 */
const fetchAllCustomQuestionsFromFirestore = async (): Promise<Question[]> => {
  const db = getFirebaseDb();
  const snapshot = await getDocs(collection(db, CUSTOM_QUESTIONS_COLLECTION));
  return snapshot.docs.map(questionDoc => toQuestion(questionDoc.id, questionDoc.data()));
};

/**
 * Delta read — only returns documents changed/created after `sinceMs`. On a
 * day with no admin activity this returns an empty snapshot, which is a very
 * cheap Firestore read compared to pulling the whole collection.
 */
const fetchChangedCustomQuestionsFromFirestore = async (sinceMs: number): Promise<Question[]> => {
  const db = getFirebaseDb();
  const changedQuery = query(collection(db, CUSTOM_QUESTIONS_COLLECTION), where('updatedAtMs', '>', sinceMs));
  const snapshot = await getDocs(changedQuery);
  return snapshot.docs.map(questionDoc => toQuestion(questionDoc.id, questionDoc.data()));
};

/**
 * Returns admin-added custom questions using a local-first strategy:
 *  - First run on a device (or once a day): full collection download,
 *    replacing the local cache entirely (this is what catches deletions).
 *  - Every other check: a cheap delta query for docs changed since the last
 *    sync, merged into the existing local cache.
 *  - In between sync checks (SYNC_CHECK_INTERVAL_MS), gameplay reads straight
 *    from the in-memory/local cache with zero Firestore reads.
 * Pass `forceRefresh: true` to bypass the interval throttle (e.g. right after
 * the admin adds/edits a question from inside the same running session).
 */
export const listCustomQuestions = async ({ forceRefresh = false }: { forceRefresh?: boolean } = {}): Promise<Question[]> => {
  if (!isFirebaseConfigured()) {
    return [];
  }

  if (!memoryCache) {
    memoryCache = await readPersistedCache();
  }

  const now = Date.now();
  const dueForSyncCheck = !memoryCache || now - memoryCache.lastSyncMs >= SYNC_CHECK_INTERVAL_MS;

  if (!forceRefresh && !dueForSyncCheck && memoryCache) {
    return cacheToOrderedQuestions(memoryCache);
  }

  if (!forceRefresh && inFlightFetch) {
    return inFlightFetch;
  }

  const fetchPromise = (async () => {
    try {
      const needsFullResync = !memoryCache || now - memoryCache.lastFullSyncMs >= FULL_RESYNC_INTERVAL_MS;

      if (needsFullResync) {
        const questions = await fetchAllCustomQuestionsFromFirestore();
        const questionsById = Object.fromEntries(questions.map(question => [question.id, question]));
        const cache: PersistedCache = { questionsById, lastSyncMs: now, lastFullSyncMs: now };
        memoryCache = cache;
        void writePersistedCache(cache);
        return cacheToOrderedQuestions(cache);
      }

      const changed = await fetchChangedCustomQuestionsFromFirestore(memoryCache!.lastSyncMs);
      const questionsById = { ...memoryCache!.questionsById };
      for (const question of changed) {
        questionsById[question.id] = question;
      }
      const cache: PersistedCache = { questionsById, lastSyncMs: now, lastFullSyncMs: memoryCache!.lastFullSyncMs };
      memoryCache = cache;
      void writePersistedCache(cache);
      return cacheToOrderedQuestions(cache);
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