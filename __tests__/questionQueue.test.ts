import { Question } from '../src/types';
import {
  buildSmartMixedQuestionQueue,
  createCategoryDistribution,
  getQueueCategoryId,
  smartShuffleQuestionQueue,
} from '../src/services/questions/questionQueue';
import { QuestionHistoryState } from '../src/services/questions/questionHistoryTypes';

const makeQuestion = (id: string, categoryId: string, overrides: Partial<Question> = {}): Question => ({
  id,
  type: 'multiple_choice',
  categoryId,
  ageGroups: ['family'],
  difficulty: 'medium',
  questionAr: `سؤال ${id}`,
  questionEn: `Question ${id}`,
  answersAr: ['أ', 'ب', 'ج', 'د'],
  answersEn: ['A', 'B', 'C', 'D'],
  correctAnswerIndex: 0,
  correctAnswerAr: 'أ',
  correctAnswerEn: 'A',
  points: 20,
  isKidsSafe: true,
  isActive: true,
  isPremium: false,
  ...overrides,
});

const makePool = (categoryIds: string[], countPerCategory: number) => categoryIds.flatMap(categoryId => (
  Array.from({ length: countPerCategory }, (_, index) => makeQuestion(`${categoryId}-${index}`, categoryId))
));

const makeHistory = (entries: QuestionHistoryState['entries'], recentQuestionIds: string[] = []): QuestionHistoryState => ({
  entries,
  recentQuestionIds,
  pendingSyncQuestionIds: [],
  updatedAtMs: Date.now(),
});

describe('questionQueue', () => {
  test('distributes requested question count across selected categories', () => {
    const distribution = createCategoryDistribution(['sports', 'science', 'history'], 10);
    const counts = Object.values(distribution);

    expect(counts.reduce((sum, count) => sum + count, 0)).toBe(10);
    expect(Math.max(...counts) - Math.min(...counts)).toBeLessThanOrEqual(1);
  });

  test('builds a balanced mixed queue and avoids same-category adjacency when possible', () => {
    const queue = buildSmartMixedQuestionQueue({
      pool: makePool(['sports', 'science', 'history'], 4),
      categoryIds: ['sports', 'science', 'history'],
      questionCount: 9,
    });

    expect(queue).toHaveLength(9);
    expect(new Set(queue.map(question => question.id)).size).toBe(9);
    expect(queue.some(question => question.type === 'multiple_choice')).toBe(true);

    for (let index = 1; index < queue.length; index += 1) {
      expect(getQueueCategoryId(queue[index])).not.toBe(getQueueCategoryId(queue[index - 1]));
    }
  });

  test('redistributes shortage from an empty category to categories with available questions', () => {
    const queue = buildSmartMixedQuestionQueue({
      pool: [
        ...makePool(['sports'], 2),
        ...makePool(['science'], 4),
      ],
      categoryIds: ['sports', 'science', 'history'],
      questionCount: 5,
    });

    expect(queue).toHaveLength(5);
    expect(queue.some(question => getQueueCategoryId(question) === 'history')).toBe(false);
    expect(new Set(queue.map(question => question.id)).size).toBe(5);
  });

  test('prioritizes unseen questions before seen questions in the same category', () => {
    const seenQuestion = makeQuestion('sports-seen', 'sports');
    const unseenQuestion = makeQuestion('sports-unseen', 'sports');
    const queue = buildSmartMixedQuestionQueue({
      pool: [seenQuestion, unseenQuestion],
      categoryIds: ['sports'],
      questionCount: 1,
      history: makeHistory({
        [seenQuestion.id]: { questionId: seenQuestion.id, categoryId: 'sports', lastSeenAt: Date.now(), seenCount: 10 },
      }),
    });

    expect(queue[0].id).toBe(unseenQuestion.id);
  });

  test('uses oldest seen questions before recent questions when unseen questions are not enough', () => {
    const oldSeenQuestion = makeQuestion('old-seen', 'sports');
    const recentQuestion = makeQuestion('recent-seen', 'sports');
    const queue = buildSmartMixedQuestionQueue({
      pool: [oldSeenQuestion, recentQuestion],
      categoryIds: ['sports'],
      questionCount: 1,
      history: makeHistory({
        [oldSeenQuestion.id]: { questionId: oldSeenQuestion.id, categoryId: 'sports', lastSeenAt: 1000, seenCount: 1 },
        [recentQuestion.id]: { questionId: recentQuestion.id, categoryId: 'sports', lastSeenAt: 2000, seenCount: 1 },
      }, [recentQuestion.id]),
    });

    expect(queue[0].id).toBe(oldSeenQuestion.id);
  });

  test('prefers unseen questions from other categories before using seen fallback', () => {
    const sportsSeen = makeQuestion('sports-seen', 'sports');
    const scienceUnseen1 = makeQuestion('science-unseen-1', 'science');
    const scienceUnseen2 = makeQuestion('science-unseen-2', 'science');

    const queue = buildSmartMixedQuestionQueue({
      pool: [sportsSeen, scienceUnseen1, scienceUnseen2],
      categoryIds: ['sports', 'science'],
      questionCount: 2,
      history: makeHistory({
        [sportsSeen.id]: { questionId: sportsSeen.id, categoryId: 'sports', lastSeenAt: Date.now(), seenCount: 4 },
      }),
    });

    expect(queue).toHaveLength(2);
    expect(queue.map(question => question.id)).not.toContain(sportsSeen.id);
  });

  test('keeps mixed question types in one queue without changing their content', () => {
    const trueFalseQuestion = makeQuestion('true-false', 'sports', {
      type: 'true_false',
      answersAr: ['صح', 'خطأ'],
      answersEn: ['True', 'False'],
      correctAnswerIndex: 0,
    });
    const imageQuestion = makeQuestion('image', 'science', {
      type: 'image',
      imageUrl: 'https://example.com/question.png',
    });
    const directQuestion = makeQuestion('direct', 'history', {
      type: 'direct',
      answersAr: [],
      answersEn: [],
      correctAnswerIndex: undefined,
    });

    const queue = buildSmartMixedQuestionQueue({
      pool: [trueFalseQuestion, imageQuestion, directQuestion],
      categoryIds: ['sports', 'science', 'history'],
      questionCount: 3,
    });

    expect(new Set(queue.map(question => question.type))).toEqual(new Set(['true_false', 'image', 'direct']));
    expect(queue.find(question => question.id === imageQuestion.id)?.imageUrl).toBe(imageQuestion.imageUrl);
    expect(queue.find(question => question.id === directQuestion.id)?.answersAr).toEqual([]);
  });

  test('uses queueCategoryId when a linked-category question fills another category bucket', () => {
    const queue = buildSmartMixedQuestionQueue({
      pool: [makeQuestion('linked', 'sports', { linkedCategoryIds: ['science'] })],
      categoryIds: ['science'],
      questionCount: 1,
    });

    expect(queue[0].categoryId).toBe('sports');
    expect(queue[0].queueCategoryId).toBe('science');
  });

  test('smartShuffleQuestionQueue keeps unavoidable repeats only when one category dominates', () => {
    const queue = smartShuffleQuestionQueue([
      ...makePool(['sports'], 4),
      ...makePool(['science'], 1),
    ]);
    const scienceIndex = queue.findIndex(question => getQueueCategoryId(question) === 'science');

    expect(queue).toHaveLength(5);
    expect(scienceIndex).toBeGreaterThan(0);
    expect(scienceIndex).toBeLessThan(4);
  });
});