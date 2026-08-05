import AsyncStorage from '@react-native-async-storage/async-storage';
import { Question, GameSettings } from '../../types';
import { QUESTIONS } from './questionsData';
import { shuffle, calcProgressivePoints } from '../../utils/helpers';
import { DIFFICULTY_POINTS } from '../../constants';
import { getCategoriesWithQuestionsForAge } from './questionCatalog';
import { canQuestionAppearForAge } from './questionPolicies';
import { listCustomQuestions } from './customQuestionService';
const QUESTION_HISTORY_KEY = 'questionHistory';
const QUESTION_HISTORY_LIMIT = 250;
const RECENT_HISTORY_BLOCK_MULTIPLIER = 3;

type QuestionHistoryEntry = {
  lastSeenAt: number;
  seenCount: number;
};

type QuestionHistory = Record<string, QuestionHistoryEntry>;

const normalizeHistory = (rawHistory: unknown): QuestionHistory => {
  if (!rawHistory || typeof rawHistory !== 'object') return {};

  return Object.fromEntries(
    Object.entries(rawHistory as Record<string, number | Partial<QuestionHistoryEntry>>).map(([id, value]) => {
      if (typeof value === 'number') {
        return [id, { lastSeenAt: value, seenCount: 1 }];
      }

      return [id, {
        lastSeenAt: typeof value.lastSeenAt === 'number' ? value.lastSeenAt : 0,
        seenCount: typeof value.seenCount === 'number' ? value.seenCount : 1,
      }];
    }),
  );
};

const readHistory = async (): Promise<QuestionHistory> => {
  try {
    const raw = await AsyncStorage.getItem(QUESTION_HISTORY_KEY);
    return raw ? normalizeHistory(JSON.parse(raw)) : {};
  } catch {
    return {};
  }
};

const writeHistory = async (history: QuestionHistory) => {
  const trimmedEntries = Object.entries(history)
    .sort((a, b) => b[1].lastSeenAt - a[1].lastSeenAt)
    .slice(0, QUESTION_HISTORY_LIMIT);

  try {
    await AsyncStorage.setItem(QUESTION_HISTORY_KEY, JSON.stringify(Object.fromEntries(trimmedEntries)));
  } catch {}
};

const shuffleQuestionAnswers = (question: Question): Question => {
  const correctIndex = question.correctAnswerIndex;
  const answerCount = Math.max(question.answersAr?.length ?? 0, question.answersEn?.length ?? 0);

  if (correctIndex == null || correctIndex < 0 || correctIndex >= answerCount || answerCount < 2) {
    return question;
  }

  const answerOrder = shuffle(Array.from({ length: answerCount }, (_, index) => index));
  const nextCorrectIndex = answerOrder.indexOf(correctIndex);
  const reorderAnswers = (answers: string[]) => answerOrder
    .map(index => answers[index])
    .filter((answer): answer is string => typeof answer === 'string');

  return {
    ...question,
    answersAr: reorderAnswers(question.answersAr ?? []),
    answersEn: reorderAnswers(question.answersEn ?? []),
    correctAnswerIndex: nextCorrectIndex,
  };
};

export async function getQuestions(settings: GameSettings): Promise<Question[]> {
  const { categories, ageGroup, difficulty, questionCount, questionLanguage, allowRepeat } = settings;
  const customQuestions = await listCustomQuestions().catch(() => []);
  const customQuestionsById = new Map(customQuestions.map(question => [question.id, question]));
  const builtinQuestions = QUESTIONS.map(question => customQuestionsById.get(question.id) ?? question);
  const builtinQuestionIds = new Set(QUESTIONS.map(question => question.id));
  const newCustomQuestions = customQuestions.filter(question => !builtinQuestionIds.has(question.id));
  const allQuestions = [...builtinQuestions, ...newCustomQuestions];
  const requestedCategories = categories.length ? categories : getCategoriesWithQuestionsForAge(ageGroup);
  const activeCategories = requestedCategories.length
    ? requestedCategories
    : getCategoriesWithQuestionsForAge(ageGroup);

  const matchesLanguage = (question: Question) => {
    if (questionLanguage === 'ar') {
      return Boolean(question.questionAr);
    }

    if (questionLanguage === 'en') {
      return Boolean(question.questionEn);
    }

    return true;
  };

  let pool = allQuestions.filter(q => {
    if (!q.isActive) return false;
    if (!activeCategories.includes(q.categoryId)) return false;
    if (!canQuestionAppearForAge(q, ageGroup)) return false;
    if (!matchesLanguage(q)) return false;
    if (difficulty !== 'progressive' && q.difficulty !== difficulty) return false;
    return true;
  });

  if (pool.length === 0) {
    pool = allQuestions.filter(q =>
      q.isActive &&
      activeCategories.includes(q.categoryId) &&
      canQuestionAppearForAge(q, ageGroup) &&
      matchesLanguage(q),
    );
  }

  if (pool.length === 0) {
    pool = allQuestions.filter(q => q.isActive && canQuestionAppearForAge(q, ageGroup) && matchesLanguage(q));
  }

  let selected: Question[] = [];

  if (!allowRepeat && pool.length > 0) {
    const history = await readHistory();
    const neverSeenPool = shuffle(pool.filter(question => history[question.id] == null));
    const recentBlockedCount = Math.min(pool.length, Math.max(questionCount, questionCount * RECENT_HISTORY_BLOCK_MULTIPLIER));
    const recentlySeenIds = new Set(
      Object.entries(history)
        .sort((a, b) => b[1].lastSeenAt - a[1].lastSeenAt)
        .slice(0, recentBlockedCount)
        .map(([id]) => id),
    );
    const freshPool = pool.filter(question => !recentlySeenIds.has(question.id));
    const fallbackPool = pool.filter(question => recentlySeenIds.has(question.id));
    const orderByLeastUsed = (questions: Question[]) => shuffle(questions).sort((a, b) => {
      const left = history[a.id] ?? { lastSeenAt: 0, seenCount: 0 };
      const right = history[b.id] ?? { lastSeenAt: 0, seenCount: 0 };
      if (left.seenCount !== right.seenCount) return left.seenCount - right.seenCount;
      return left.lastSeenAt - right.lastSeenAt;
    });

    selected = neverSeenPool.length >= questionCount
      ? neverSeenPool.slice(0, questionCount)
      : [
        ...neverSeenPool,
        ...orderByLeastUsed(freshPool.filter(question => history[question.id] != null)),
        ...orderByLeastUsed(fallbackPool),
      ].slice(0, questionCount);

    if (selected.length > 0) {
      const nextHistory = { ...history };
      const now = Date.now();
      selected.forEach((question, index) => {
        const previous = nextHistory[question.id] ?? { lastSeenAt: 0, seenCount: 0 };
        nextHistory[question.id] = {
          lastSeenAt: now + index,
          seenCount: previous.seenCount + 1,
        };
      });
      await writeHistory(nextHistory);
    }
  } else {
    selected = shuffle(pool).slice(0, questionCount);
  }

  const randomizedSelection = shuffle(selected).map(shuffleQuestionAnswers);

  if (difficulty === 'progressive') {
    return randomizedSelection.map((q, i) => {
      const level = calcProgressivePoints(i, selected.length);
      return { ...q, points: DIFFICULTY_POINTS[level] };
    });
  }

  return randomizedSelection;
}
