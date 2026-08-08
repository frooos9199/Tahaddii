import { CategoryId, Question } from '../../types';
import { getOldestSeenQuestions, getRecentQuestionIds, getUnseenQuestions } from './questionHistorySelector';
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

type CategoryQuestionBuckets = {
  unseenNonRecent: Question[];
  unseenRecent: Question[];
  seenNonRecent: Question[];
  seenRecent: Question[];
};

type BucketName = keyof CategoryQuestionBuckets;

const buildCategoryBuckets = (questions: Question[], history: QuestionHistoryState): CategoryQuestionBuckets => {
  const recentIds = getRecentQuestionIds(history);
  // New questions (with a createdAtMs timestamp) are boosted to the front of the
  // unseen pool so they surface soon after being added, instead of waiting for
  // a random shuffle to eventually pick them. Questions without a timestamp
  // (built-in bank questions) all tie at 0 and stay randomly shuffled among themselves.
  const unseen = getUnseenQuestions(questions, history)
    .map(question => ({ question, jitter: Math.random() }))
    .sort((left, right) => (right.question.createdAtMs ?? 0) - (left.question.createdAtMs ?? 0) || left.jitter - right.jitter)
    .map(({ question }) => question);
  const seen = getOldestSeenQuestions(questions, history);

  return {
    unseenNonRecent: unseen.filter(question => !recentIds.has(question.id)),
    unseenRecent: unseen.filter(question => recentIds.has(question.id)),
    seenNonRecent: seen.filter(question => !recentIds.has(question.id)),
    seenRecent: seen.filter(question => recentIds.has(question.id)),
  };
};

const takeFromBucket = ({
  categoryId,
  poolsByCategory,
  bucket,
  usedQuestionIds,
}: {
  categoryId: CategoryId;
  poolsByCategory: Map<CategoryId, CategoryQuestionBuckets>;
  bucket: BucketName;
  usedQuestionIds: Set<string>;
}) => {
  const categoryPools = poolsByCategory.get(categoryId);
  const pool = categoryPools?.[bucket] ?? [];
  while (pool.length) {
    const question = pool.shift();
    if (question && !usedQuestionIds.has(question.id)) {
      usedQuestionIds.add(question.id);
      return { ...question, queueCategoryId: categoryId };
    }
  }
  return null;
};

const pickBestCategory = ({
  categoryIds,
  poolsByCategory,
  selectedCountByCategory,
  bucket,
}: {
  categoryIds: CategoryId[];
  poolsByCategory: Map<CategoryId, CategoryQuestionBuckets>;
  selectedCountByCategory: Map<CategoryId, number>;
  bucket: BucketName;
}) => {
  const eligible = categoryIds.filter(categoryId => (poolsByCategory.get(categoryId)?.[bucket].length ?? 0) > 0);
  if (!eligible.length) return null;

  return eligible.sort((left, right) => (
    (selectedCountByCategory.get(left) ?? 0) - (selectedCountByCategory.get(right) ?? 0)
    || Math.random() - 0.5
  ))[0];
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
  const normalizedHistory = history ?? EMPTY_QUESTION_HISTORY;
  const poolsByCategory = new Map(activeCategoryIds.map(categoryId => [
    categoryId,
    buildCategoryBuckets(
      pool.filter(question => getQuestionCategoryIds(question).includes(categoryId)),
      normalizedHistory,
    ),
  ]));
  const selectedQuestions: Question[] = [];
  const selectedCountByCategory = new Map<CategoryId, number>();
  const usedQuestionIds = new Set<string>();
  const maxSelectable = Math.min(questionCount, pool.length);
  const pushSelected = (question: Question) => {
    selectedQuestions.push(question);
    selectedCountByCategory.set(question.queueCategoryId || question.categoryId, (selectedCountByCategory.get(question.queueCategoryId || question.categoryId) ?? 0) + 1);
  };

  // Phase 1: Respect category distribution using unseen questions first.
  Object.entries(distribution).forEach(([categoryId, count]) => {
    for (let index = 0; index < count && selectedQuestions.length < maxSelectable; index += 1) {
      const nextQuestion = takeFromBucket({
        categoryId,
        poolsByCategory,
        bucket: 'unseenNonRecent',
        usedQuestionIds,
      }) || takeFromBucket({
        categoryId,
        poolsByCategory,
        bucket: 'unseenRecent',
        usedQuestionIds,
      });
      if (!nextQuestion) break;
      pushSelected(nextQuestion);
    }
  });

  // Phase 2: Fill any remaining slots with unseen questions from all categories.
  while (selectedQuestions.length < maxSelectable) {
    const categoryId = pickBestCategory({
      categoryIds: activeCategoryIds,
      poolsByCategory,
      selectedCountByCategory,
      bucket: 'unseenNonRecent',
    }) ?? pickBestCategory({
      categoryIds: activeCategoryIds,
      poolsByCategory,
      selectedCountByCategory,
      bucket: 'unseenRecent',
    });
    if (!categoryId) break;
    const nextQuestion = takeFromBucket({
      categoryId,
      poolsByCategory,
      bucket: 'unseenNonRecent',
      usedQuestionIds,
    }) || takeFromBucket({
      categoryId,
      poolsByCategory,
      bucket: 'unseenRecent',
      usedQuestionIds,
    });
    if (!nextQuestion) break;
    pushSelected(nextQuestion);
  }

  // Phase 3/4: If unseen is not enough, fallback to seen non-recent then recent.
  (['seenNonRecent', 'seenRecent'] as const).forEach(bucket => {
    while (selectedQuestions.length < maxSelectable) {
      const categoryId = pickBestCategory({
        categoryIds: activeCategoryIds,
        poolsByCategory,
        selectedCountByCategory,
        bucket,
      });
      if (!categoryId) break;
      const nextQuestion = takeFromBucket({
        categoryId,
        poolsByCategory,
        bucket,
        usedQuestionIds,
      });
      if (!nextQuestion) break;
      pushSelected(nextQuestion);
    }
  });

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