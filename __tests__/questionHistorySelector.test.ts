import { Question } from '../src/types';
import { selectQuestionsWithHistory } from '../src/services/questions/questionHistorySelector';
import { QuestionHistoryState } from '../src/services/questions/questionHistoryTypes';

const makeQuestion = (id: string, categoryId = 'kuwait'): Question => ({
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
});

const makeHistory = (entries: QuestionHistoryState['entries'], recentQuestionIds: string[] = []): QuestionHistoryState => ({
  entries,
  recentQuestionIds,
  pendingSyncQuestionIds: [],
  updatedAtMs: Date.now(),
});

describe('questionHistorySelector', () => {
  test('selects only unseen questions when enough are available', () => {
    const seenQuestion = makeQuestion('seen');
    const unseenQuestions = [makeQuestion('unseen-1'), makeQuestion('unseen-2')];
    const selected = selectQuestionsWithHistory({
      questions: [seenQuestion, ...unseenQuestions],
      requiredCount: 2,
      history: makeHistory({
        [seenQuestion.id]: { questionId: seenQuestion.id, categoryId: 'kuwait', lastSeenAt: 1000, seenCount: 1 },
      }),
    });

    expect(new Set(selected.map(question => question.id))).toEqual(new Set(unseenQuestions.map(question => question.id)));
  });

  test('fills shortage with oldest seen questions', () => {
    const unseenQuestion = makeQuestion('unseen');
    const oldSeenQuestion = makeQuestion('old-seen');
    const newerSeenQuestion = makeQuestion('newer-seen');
    const selected = selectQuestionsWithHistory({
      questions: [newerSeenQuestion, unseenQuestion, oldSeenQuestion],
      requiredCount: 2,
      history: makeHistory({
        [oldSeenQuestion.id]: { questionId: oldSeenQuestion.id, categoryId: 'kuwait', lastSeenAt: 1000, seenCount: 1 },
        [newerSeenQuestion.id]: { questionId: newerSeenQuestion.id, categoryId: 'kuwait', lastSeenAt: 2000, seenCount: 1 },
      }),
    });

    expect(selected.map(question => question.id)).toContain(unseenQuestion.id);
    expect(selected.map(question => question.id)).toContain(oldSeenQuestion.id);
    expect(selected.map(question => question.id)).not.toContain(newerSeenQuestion.id);
  });

  test('uses recent questions only when there is no non-recent alternative', () => {
    const oldSeenQuestion = makeQuestion('old-seen');
    const recentQuestion = makeQuestion('recent-seen');
    const selected = selectQuestionsWithHistory({
      questions: [recentQuestion, oldSeenQuestion],
      requiredCount: 1,
      history: makeHistory({
        [oldSeenQuestion.id]: { questionId: oldSeenQuestion.id, categoryId: 'kuwait', lastSeenAt: 1000, seenCount: 1 },
        [recentQuestion.id]: { questionId: recentQuestion.id, categoryId: 'kuwait', lastSeenAt: 500, seenCount: 1 },
      }, [recentQuestion.id]),
    });

    expect(selected[0].id).toBe(oldSeenQuestion.id);
  });
});