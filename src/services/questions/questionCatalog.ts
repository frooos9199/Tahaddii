import { AgeGroup, CategoryId, Difficulty, GameSettings, Question } from '../../types';
import { QUESTIONS } from './questionsData';
import { canQuestionAppearForAge, canQuestionAppearForDifficulty } from './questionPolicies';
import { listCustomQuestions } from './customQuestionService';

export const CATEGORY_CONTENT_TARGET = 200;
export const MIN_PLAYABLE_CATEGORY_QUESTIONS = 20;

export const CATEGORY_IDS: CategoryId[] = [
  'generalKnowledge', 'sports', 'football', 'cars', 'movies',
  'cartoons', 'anime', 'history', 'geography', 'science',
  'space', 'animals', 'capitals', 'riddles', 'math',
  'arabicLang', 'englishLang', 'technology', 'inventions',
  'celebrities', 'music', 'islamicCulture', 'kuwait',
  'flags', 'guessImage', 'trueFalse', 'completeSentence',
  'whoAmI', 'wouldYouRather', 'familyChallenges',
];

const counts = CATEGORY_IDS.reduce<Record<CategoryId, number>>((accumulator, categoryId) => {
  accumulator[categoryId] = 0;
  return accumulator;
}, {} as Record<CategoryId, number>);

for (const question of QUESTIONS) {
  counts[question.categoryId] = (counts[question.categoryId] ?? 0) + 1;
}

export const CATEGORY_QUESTION_COUNT: Record<CategoryId, number> = counts;

export const mergeQuestionBank = (customQuestions: Question[] = []): Question[] => {
  const customQuestionsById = new Map(customQuestions.map(question => [question.id, question]));
  const builtinQuestions = QUESTIONS.map(question => customQuestionsById.get(question.id) ?? question);
  const builtinQuestionIds = new Set(QUESTIONS.map(question => question.id));
  const newCustomQuestions = customQuestions.filter(question => !builtinQuestionIds.has(question.id));

  return [...builtinQuestions, ...newCustomQuestions];
};

export const loadQuestionBank = async (): Promise<Question[]> => mergeQuestionBank(await listCustomQuestions().catch(() => []));

export const getCategoryQuestionCountFromBank = (questions: Question[], categoryId: CategoryId) =>
  questions.filter(question => question.categoryId === categoryId && question.isActive).length;

export const getCategoryQuestionCountForAgeFromBank = (questions: Question[], categoryId: CategoryId, ageGroup: AgeGroup) =>
  questions.filter(question => question.categoryId === categoryId && question.isActive && canQuestionAppearForAge(question, ageGroup)).length;

const getCategoryIdsFromBank = (questions: Question[]) => [
  ...new Set([
    ...CATEGORY_IDS,
    ...questions.filter(question => question.isActive).map(question => question.categoryId),
  ]),
];

export const getCategoriesWithQuestionsForAgeFromBank = (questions: Question[], ageGroup: AgeGroup): CategoryId[] =>
  getCategoryIdsFromBank(questions).filter(categoryId => getCategoryQuestionCountForAgeFromBank(questions, categoryId, ageGroup) > 0);

export const getDifficultyQuestionCountForAgeFromBank = (
  questions: Question[],
  ageGroup: AgeGroup,
  categories: CategoryId[],
): Record<Difficulty, number> => ({
  easy: questions.filter(question => question.isActive && categories.includes(question.categoryId) && canQuestionAppearForDifficulty(question, 'easy') && canQuestionAppearForAge(question, ageGroup)).length,
  medium: questions.filter(question => question.isActive && categories.includes(question.categoryId) && canQuestionAppearForDifficulty(question, 'medium') && canQuestionAppearForAge(question, ageGroup)).length,
  hard: questions.filter(question => question.isActive && categories.includes(question.categoryId) && canQuestionAppearForDifficulty(question, 'hard') && canQuestionAppearForAge(question, ageGroup)).length,
});

export const getAvailableQuestionCountFromBank = (
  questions: Question[],
  settings: Pick<GameSettings, 'categories' | 'ageGroup' | 'difficulty' | 'questionLanguage'>,
) => {
  const activeCategories = settings.categories.length
    ? settings.categories
    : getCategoriesWithQuestionsForAgeFromBank(questions, settings.ageGroup);

  const matchesLanguage = (question: Question) => {
    if (settings.questionLanguage === 'ar') {
      return Boolean(question.questionAr);
    }

    if (settings.questionLanguage === 'en') {
      return Boolean(question.questionEn);
    }

    return true;
  };

  return questions.filter(question => {
    if (!question.isActive) return false;
    if (!activeCategories.includes(question.categoryId)) return false;
    if (!canQuestionAppearForAge(question, settings.ageGroup)) return false;
    if (!matchesLanguage(question)) return false;
    if (!canQuestionAppearForDifficulty(question, settings.difficulty)) return false;
    return true;
  }).length;
};

export const getCategoryQuestionCount = (categoryId: CategoryId) => CATEGORY_QUESTION_COUNT[categoryId] ?? 0;

export const getCategoryQuestionCountForAge = (categoryId: CategoryId, ageGroup: AgeGroup) =>
  QUESTIONS.filter(question => question.categoryId === categoryId && canQuestionAppearForAge(question, ageGroup)).length;

export const isCategoryPlayable = (categoryId: CategoryId) => getCategoryQuestionCount(categoryId) >= MIN_PLAYABLE_CATEGORY_QUESTIONS;

export const isCategoryPlayableForAge = (categoryId: CategoryId, ageGroup: AgeGroup) =>
  getCategoryQuestionCountForAge(categoryId, ageGroup) >= MIN_PLAYABLE_CATEGORY_QUESTIONS;

export const isCategoryContentComplete = (categoryId: CategoryId) => getCategoryQuestionCount(categoryId) >= CATEGORY_CONTENT_TARGET;

export const getDifficultyQuestionCountForAge = (
  ageGroup: AgeGroup,
  categories: CategoryId[],
): Record<Difficulty, number> => ({
  easy: QUESTIONS.filter(question => categories.includes(question.categoryId) && canQuestionAppearForDifficulty(question, 'easy') && canQuestionAppearForAge(question, ageGroup)).length,
  medium: QUESTIONS.filter(question => categories.includes(question.categoryId) && canQuestionAppearForDifficulty(question, 'medium') && canQuestionAppearForAge(question, ageGroup)).length,
  hard: QUESTIONS.filter(question => categories.includes(question.categoryId) && canQuestionAppearForDifficulty(question, 'hard') && canQuestionAppearForAge(question, ageGroup)).length,
});

export const getPlayableCategories = (): CategoryId[] => CATEGORY_IDS.filter(isCategoryPlayable);

export const getPlayableCategoriesForAge = (ageGroup: AgeGroup): CategoryId[] => CATEGORY_IDS.filter(categoryId => isCategoryPlayableForAge(categoryId, ageGroup));

export const getCategoriesWithQuestionsForAge = (ageGroup: AgeGroup): CategoryId[] =>
  CATEGORY_IDS.filter(categoryId => getCategoryQuestionCountForAge(categoryId, ageGroup) > 0);

export const getAvailableQuestionCount = (settings: Pick<GameSettings, 'categories' | 'ageGroup' | 'difficulty' | 'questionLanguage'>) => {
  const activeCategories = settings.categories.length
    ? settings.categories
    : getCategoriesWithQuestionsForAge(settings.ageGroup);

  const matchesLanguage = (question: (typeof QUESTIONS)[number]) => {
    if (settings.questionLanguage === 'ar') {
      return Boolean(question.questionAr);
    }

    if (settings.questionLanguage === 'en') {
      return Boolean(question.questionEn);
    }

    return true;
  };

  return QUESTIONS.filter(question => {
    if (!question.isActive) return false;
    if (!activeCategories.includes(question.categoryId)) return false;
    if (!canQuestionAppearForAge(question, settings.ageGroup)) return false;
    if (!matchesLanguage(question)) return false;
    if (!canQuestionAppearForDifficulty(question, settings.difficulty)) return false;
    return true;
  }).length;
};

export const getFairQuestionCountOptions = ({
  availableQuestionCount,
  playerCount,
}: {
  availableQuestionCount: number;
  playerCount: number;
}) => {
  if (availableQuestionCount <= 0) {
    return [];
  }

  const turnUnit = Math.max(1, playerCount || 1);

  if (turnUnit <= 1) {
    return [5, 10, 15, 20, 30, 40, 50].filter(option => option <= availableQuestionCount);
  }

  const multipliers = [1, 2, 3, 4, 5, 6, 8, 10];
  return [...new Set(
    multipliers
      .map(multiplier => multiplier * turnUnit)
      .filter(option => option <= availableQuestionCount),
  )].sort((left, right) => left - right);
};

export const getRecommendedFairQuestionCount = ({
  availableQuestionCount,
  playerCount,
}: {
  availableQuestionCount: number;
  playerCount: number;
}) => {
  const options = getFairQuestionCountOptions({ availableQuestionCount, playerCount });
  if (options.length > 0) {
    return options[Math.min(1, options.length - 1)] ?? options[options.length - 1];
  }

  return Math.max(1, Math.min(availableQuestionCount, Math.max(1, playerCount || 1)));
};