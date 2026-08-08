import { CategoryId, Question } from '../../types';
import { selectQuestionsWithHistory } from './questionHistorySelector';
import { EMPTY_QUESTION_HISTORY, QuestionHistoryState } from './questionHistoryTypes';

export const getQueueCategoryId = (question: Pick<Question, 'categoryId' | 'queueCategoryId'>) => question.queueCategoryId || question.categoryId;

const getQuestionCategoryIds = (question: Pick<Question, 'categoryId' | 'linkedCategoryIds'>) => [
  question.categoryId,
  ...(question.linkedCategoryIds ?? []),
];

export const createCategoryDistribution = (categoryIds: CategoryId[], questionCount: number): Record<CategoryId, number> => {
  const uniqueCategoryIds = [...new Set(categoryIds)].filter(Boolean);
  if (!uniqueCategoryIds.length || questionCount <= 0) return {} as Record<CategoryId, number>;

  const shuffledCategoryIds = [...uniqueCategoryIds].sort(() => Math.random() - 0.5);
  const baseCount = Math.floor(questionCount / shuffledCategoryIds.length);
  let remainder = questionCount % shuffledCategoryIds.length;

  return Object.fromEntries(shuffledCategoryIds.map(categoryId => {
    const count = baseCount + (remainder > 0 ? 1 : 0);
    remainder = Math.max(0, remainder - 1);
    return [categoryId, count];
  })) as Record<CategoryId, number>;
};

const takeNextQuestion = ({
  categoryId,
  poolsByCategory,
  usedQuestionIds,
}: {
  categoryId: CategoryId;
  poolsByCategory: Map<CategoryId, Question[]>;
  usedQuestionIds: Set<string>;
}) => {
  const pool = poolsByCategory.get(categoryId) ?? [];

  while (pool.length) {
    const question = pool.shift();
    if (question && !usedQuestionIds.has(question.id)) {
      usedQuestionIds.add(question.id);
      return { ...question, queueCategoryId: categoryId };
    }
  }

  return null;
};

export const buildSmartMixedQuestionQueue = ({
  pool,
  categoryIds,
  questionCount,
  history = EMPTY_QUESTION_HISTORY,
}: {
  pool: Question[];
  categoryIds: CategoryId[];
  questionCount: number;
  history?: QuestionHistoryState;
}) => {
  if (questionCount <= 0 || !pool.length) return [];

  const playableCategoryIds = [...new Set(categoryIds)]
    .filter(categoryId => pool.some(question => getQuestionCategoryIds(question).includes(categoryId)));
  const fallbackCategoryIds = [...new Set(pool.map(question => question.categoryId))];
  const activeCategoryIds = playableCategoryIds.length ? playableCategoryIds : fallbackCategoryIds;
  const distribution = createCategoryDistribution(activeCategoryIds, questionCount);
  const poolsByCategory = new Map(activeCategoryIds.map(categoryId => [
    categoryId,
    selectQuestionsWithHistory({
      questions: pool.filter(question => getQuestionCategoryIds(question).includes(categoryId)),
      requiredCount: pool.length,
      history: history ?? EMPTY_QUESTION_HISTORY,
    }),
  ]));
  const selectedQuestions: Question[] = [];
  const selectedCountByCategory = new Map<CategoryId, number>();
  const usedQuestionIds = new Set<string>();

  Object.entries(distribution).forEach(([categoryId, count]) => {
    for (let index = 0; index < count; index += 1) {
      const nextQuestion = takeNextQuestion({ categoryId, poolsByCategory, usedQuestionIds });
      if (!nextQuestion) break;

      selectedQuestions.push(nextQuestion);
      selectedCountByCategory.set(categoryId, (selectedCountByCategory.get(categoryId) ?? 0) + 1);
    }
  });

  while (selectedQuestions.length < Math.min(questionCount, pool.length)) {
    const eligibleCategoryIds = activeCategoryIds
      .filter(categoryId => (poolsByCategory.get(categoryId) ?? []).some(question => !usedQuestionIds.has(question.id)))
      .sort((left, right) => (selectedCountByCategory.get(left) ?? 0) - (selectedCountByCategory.get(right) ?? 0) || Math.random() - 0.5);
    const categoryId = eligibleCategoryIds[0];
    if (!categoryId) break;

    const nextQuestion = takeNextQuestion({ categoryId, poolsByCategory, usedQuestionIds });
    if (!nextQuestion) break;

    selectedQuestions.push(nextQuestion);
    selectedCountByCategory.set(categoryId, (selectedCountByCategory.get(categoryId) ?? 0) + 1);
  }

  return smartShuffleQuestionQueue(selectedQuestions).slice(0, questionCount);
};

const pickNextCategoryId = (buckets: Map<CategoryId, Question[]>, previousCategoryId: CategoryId | null) => {
  const candidates = [...buckets.entries()]
    .filter(([, questions]) => questions.length > 0)
    .map(([categoryId, questions]) => ({ categoryId, count: questions.length }))
    .sort((left, right) => right.count - left.count || Math.random() - 0.5);
  if (!candidates.length) return null;

  const nonRepeatingCandidates = candidates.filter(candidate => candidate.categoryId !== previousCategoryId);
  const preferredCandidates = nonRepeatingCandidates.length ? nonRepeatingCandidates : candidates;
  const topCount = preferredCandidates[0].count;
  const topCandidates = preferredCandidates.filter(candidate => candidate.count === topCount);

  return topCandidates[Math.floor(Math.random() * topCandidates.length)]?.categoryId ?? preferredCandidates[0].categoryId;
};

export const smartShuffleQuestionQueue = (questions: Question[]) => {
  const buckets = new Map<CategoryId, Question[]>();
  questions.forEach(question => {
    const categoryId = getQueueCategoryId(question);
    const bucket = buckets.get(categoryId) ?? [];
    bucket.push(question);
    buckets.set(categoryId, bucket);
  });

  buckets.forEach((bucket, categoryId) => {
    buckets.set(categoryId, [...bucket].sort(() => Math.random() - 0.5));
  });

  const orderedQuestions: Question[] = [];
  let previousCategoryId: CategoryId | null = null;

  while (orderedQuestions.length < questions.length) {
    const categoryId = pickNextCategoryId(buckets, previousCategoryId);
    if (!categoryId) break;

    const bucket = buckets.get(categoryId) ?? [];
    const question = bucket.shift();
    if (!question) break;

    orderedQuestions.push(question);
    previousCategoryId = categoryId;
  }

  return orderedQuestions;
};