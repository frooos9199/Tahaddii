import AsyncStorage from '@react-native-async-storage/async-storage';
import { collection, doc, getDocs, serverTimestamp, writeBatch } from 'firebase/firestore';
import { Question } from '../../types';
import { getFirebaseAuth, getFirebaseDb, isFirebaseConfigured } from '../firebase/firebaseClient';
import { EMPTY_QUESTION_HISTORY, QuestionHistoryEntry, QuestionHistoryState } from './questionHistoryTypes';
import {
  getOldestSeenQuestions,
  getRecentQuestionIds,
  getUnseenQuestions,
  selectQuestionsWithHistory,
} from './questionHistorySelector';

const QUESTION_HISTORY_KEY = 'tahaddi_question_history';
const LEGACY_QUESTION_HISTORY_KEY = 'questionHistory';
const QUESTION_HISTORY_LIMIT = 5000;
const RECENT_QUESTION_LIMIT = 40;
const USERS_COLLECTION = 'users';
const QUESTION_HISTORY_COLLECTION = 'questionHistory';
const QUESTION_HISTORY_META_COLLECTION = 'questionHistoryMeta';
const QUESTION_HISTORY_META_DOC = 'state';
const FIRESTORE_BATCH_LIMIT = 450;

let cachedHistory: QuestionHistoryState | null = null;

const sanitizeQuestionDocId = (questionId: string) => encodeURIComponent(questionId);

const normalizeEntry = (questionId: string, value: unknown): QuestionHistoryEntry => {
  if (typeof value === 'number') {
    return { questionId, lastSeenAt: value, seenCount: 1 };
  }

  const rawEntry = value && typeof value === 'object' ? value as Partial<QuestionHistoryEntry> : {};
  return {
    questionId: typeof rawEntry.questionId === 'string' && rawEntry.questionId.trim() ? rawEntry.questionId : questionId,
    categoryId: typeof rawEntry.categoryId === 'string' ? rawEntry.categoryId : undefined,
    lastSeenAt: typeof rawEntry.lastSeenAt === 'number' ? rawEntry.lastSeenAt : 0,
    seenCount: typeof rawEntry.seenCount === 'number' ? rawEntry.seenCount : 1,
  };
};

export const normalizeQuestionHistory = (rawHistory: unknown): QuestionHistoryState => {
  if (!rawHistory || typeof rawHistory !== 'object') return { ...EMPTY_QUESTION_HISTORY };

  const maybeState = rawHistory as Partial<QuestionHistoryState> & Record<string, unknown>;
  const rawEntries = maybeState.entries && typeof maybeState.entries === 'object'
    ? maybeState.entries as Record<string, unknown>
    : rawHistory as Record<string, unknown>;
  const entries = Object.fromEntries(
    Object.entries(rawEntries).map(([questionId, value]) => {
      const entry = normalizeEntry(questionId, value);
      return [entry.questionId, entry];
    }),
  );

  return trimQuestionHistory({
    entries,
    recentQuestionIds: Array.isArray(maybeState.recentQuestionIds) ? maybeState.recentQuestionIds.filter((id): id is string => typeof id === 'string') : [],
    pendingSyncQuestionIds: Array.isArray(maybeState.pendingSyncQuestionIds) ? maybeState.pendingSyncQuestionIds.filter((id): id is string => typeof id === 'string') : [],
    updatedAtMs: typeof maybeState.updatedAtMs === 'number' ? maybeState.updatedAtMs : 0,
  });
};

const trimQuestionHistory = (history: QuestionHistoryState): QuestionHistoryState => {
  const entries = Object.fromEntries(
    Object.entries(history.entries)
      .sort((left, right) => right[1].lastSeenAt - left[1].lastSeenAt)
      .slice(0, QUESTION_HISTORY_LIMIT),
  );
  const validQuestionIds = new Set(Object.keys(entries));
  const recentQuestionIds = [...new Set(history.recentQuestionIds)]
    .filter(questionId => validQuestionIds.has(questionId))
    .slice(0, RECENT_QUESTION_LIMIT);
  const pendingSyncQuestionIds = [...new Set(history.pendingSyncQuestionIds)]
    .filter(questionId => validQuestionIds.has(questionId));

  return {
    entries,
    recentQuestionIds,
    pendingSyncQuestionIds,
    updatedAtMs: history.updatedAtMs,
  };
};

const readLocalQuestionHistory = async () => {
  try {
    const raw = await AsyncStorage.getItem(QUESTION_HISTORY_KEY);
    if (raw) return normalizeQuestionHistory(JSON.parse(raw));

    const legacyRaw = await AsyncStorage.getItem(LEGACY_QUESTION_HISTORY_KEY);
    if (legacyRaw) {
      const migratedHistory = normalizeQuestionHistory(JSON.parse(legacyRaw));
      await writeLocalQuestionHistory(migratedHistory);
      return migratedHistory;
    }
  } catch {}

  return { ...EMPTY_QUESTION_HISTORY };
};

const writeLocalQuestionHistory = async (history: QuestionHistoryState) => {
  const trimmedHistory = trimQuestionHistory(history);
  cachedHistory = trimmedHistory;

  try {
    await AsyncStorage.setItem(QUESTION_HISTORY_KEY, JSON.stringify(trimmedHistory));
  } catch {}

  return trimmedHistory;
};

export const getQuestionHistory = async () => {
  if (cachedHistory) return cachedHistory;
  cachedHistory = await readLocalQuestionHistory();
  return cachedHistory;
};

const getCurrentSyncUser = () => {
  if (!isFirebaseConfigured()) return null;
  const user = getFirebaseAuth().currentUser;
  return user && !user.isAnonymous ? user : null;
};

export const mergeQuestionHistory = (left: QuestionHistoryState, right: QuestionHistoryState): QuestionHistoryState => {
  const entries = { ...left.entries };
  Object.entries(right.entries).forEach(([questionId, rightEntry]) => {
    const leftEntry = entries[questionId];
    entries[questionId] = {
      questionId,
      categoryId: rightEntry.categoryId ?? leftEntry?.categoryId,
      lastSeenAt: Math.max(leftEntry?.lastSeenAt ?? 0, rightEntry.lastSeenAt),
      seenCount: Math.max(leftEntry?.seenCount ?? 0, rightEntry.seenCount),
    };
  });

  const recentQuestionIds = [...left.recentQuestionIds, ...right.recentQuestionIds]
    .filter((questionId, index, ids) => ids.indexOf(questionId) === index)
    .sort((leftId, rightId) => (entries[rightId]?.lastSeenAt ?? 0) - (entries[leftId]?.lastSeenAt ?? 0));
  const pendingSyncQuestionIds = [...new Set([...left.pendingSyncQuestionIds, ...right.pendingSyncQuestionIds])];

  return trimQuestionHistory({
    entries,
    recentQuestionIds,
    pendingSyncQuestionIds,
    updatedAtMs: Math.max(left.updatedAtMs, right.updatedAtMs),
  });
};

const readRemoteQuestionHistory = async (uid: string): Promise<QuestionHistoryState> => {
  try {
    const db = getFirebaseDb();
    const historySnapshot = await getDocs(collection(db, USERS_COLLECTION, uid, QUESTION_HISTORY_COLLECTION));
    const entries: Record<string, QuestionHistoryEntry> = {};

    historySnapshot.forEach(snapshot => {
      const data = snapshot.data();
      const entry = normalizeEntry(typeof data.questionId === 'string' ? data.questionId : snapshot.id, data);
      entries[entry.questionId] = entry;
    });

    const metaSnapshot = await getDocs(collection(db, USERS_COLLECTION, uid, QUESTION_HISTORY_META_COLLECTION));
    let recentQuestionIds: string[] = [];
    let updatedAtMs = 0;
    metaSnapshot.forEach(snapshot => {
      if (snapshot.id !== QUESTION_HISTORY_META_DOC) return;
      const data = snapshot.data();
      recentQuestionIds = Array.isArray(data.recentQuestionIds) ? data.recentQuestionIds.filter((id): id is string => typeof id === 'string') : [];
      updatedAtMs = typeof data.updatedAtMs === 'number' ? data.updatedAtMs : 0;
    });

    return trimQuestionHistory({ entries, recentQuestionIds, pendingSyncQuestionIds: [], updatedAtMs });
  } catch {
    return { ...EMPTY_QUESTION_HISTORY };
  }
};

export const syncQuestionHistory = async (uid = getCurrentSyncUser()?.uid) => {
  if (!uid) return;

  const history = await getQuestionHistory();
  const questionIdsToSync = history.pendingSyncQuestionIds.length ? history.pendingSyncQuestionIds : Object.keys(history.entries);
  if (!questionIdsToSync.length) return;

  try {
    const db = getFirebaseDb();
    for (let index = 0; index < questionIdsToSync.length; index += FIRESTORE_BATCH_LIMIT) {
      const batch = writeBatch(db);
      questionIdsToSync.slice(index, index + FIRESTORE_BATCH_LIMIT).forEach(questionId => {
        const entry = history.entries[questionId];
        if (!entry) return;
        batch.set(doc(db, USERS_COLLECTION, uid, QUESTION_HISTORY_COLLECTION, sanitizeQuestionDocId(questionId)), {
          questionId: entry.questionId,
          categoryId: entry.categoryId ?? null,
          lastSeenAt: entry.lastSeenAt,
          seenCount: entry.seenCount,
          syncedAt: serverTimestamp(),
        }, { merge: true });
      });
      await batch.commit();
    }

    const metaBatch = writeBatch(db);
    metaBatch.set(doc(db, USERS_COLLECTION, uid, QUESTION_HISTORY_META_COLLECTION, QUESTION_HISTORY_META_DOC), {
      recentQuestionIds: history.recentQuestionIds,
      updatedAtMs: Date.now(),
      syncedAt: serverTimestamp(),
    }, { merge: true });
    await metaBatch.commit();
    await writeLocalQuestionHistory({ ...history, pendingSyncQuestionIds: [] });
  } catch {}
};

export const mergeLocalHistoryWithFirebase = async (uid: string) => {
  const localHistory = await getQuestionHistory();
  const remoteHistory = await readRemoteQuestionHistory(uid);
  const mergedHistory = mergeQuestionHistory(localHistory, remoteHistory);
  await writeLocalQuestionHistory({
    ...mergedHistory,
    pendingSyncQuestionIds: Object.keys(mergedHistory.entries),
    updatedAtMs: Date.now(),
  });
  await syncQuestionHistory(uid);
};

export const markQuestionsAsSeen = async (questions: Question[]) => {
  if (!questions.length) return;

  const history = await getQuestionHistory();
  const now = Date.now();
  const entries = { ...history.entries };
  const nextRecentQuestionIds = [...history.recentQuestionIds];
  const nextPendingQuestionIds = new Set(history.pendingSyncQuestionIds);

  questions.forEach((question, index) => {
    const previous = entries[question.id];
    entries[question.id] = {
      questionId: question.id,
      categoryId: question.queueCategoryId || question.categoryId,
      lastSeenAt: now + index,
      seenCount: (previous?.seenCount ?? 0) + 1,
    };
    nextRecentQuestionIds.unshift(question.id);
    nextPendingQuestionIds.add(question.id);
  });

  await writeLocalQuestionHistory({
    entries,
    recentQuestionIds: [...new Set(nextRecentQuestionIds)].slice(0, RECENT_QUESTION_LIMIT),
    pendingSyncQuestionIds: [...nextPendingQuestionIds],
    updatedAtMs: now,
  });
};

export {
  getOldestSeenQuestions,
  getRecentQuestionIds,
  getUnseenQuestions,
  selectQuestionsWithHistory,
};