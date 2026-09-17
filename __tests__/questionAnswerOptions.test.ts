import { GameSettings, Question } from '../src/types';
import { areAnswerOptionsEnabled, getQuestionAnswers, getQuestionMediaKind } from '../src/utils/questionAnswerOptions';

const settings: GameSettings = {
  mode: 'group', ageGroup: 'family', categories: [], difficulty: 'progressive',
  questionCount: 3, timePerQuestion: 0, questionLanguage: 'ar', randomOrder: false,
  allowRepeat: false, showTextAnswerOptions: false, showImageAnswerOptions: true,
  showVideoAnswerOptions: false, soundEnabled: true, readQuestion: false,
  lifelines: { enabled: true, fiftyFifty: 1, extraTime: 1, changeQuestion: 1, hint: 1 },
};

const question = (overrides: Partial<Question> = {}): Question => ({
  id: 'question-1', type: 'multiple_choice', categoryId: 'general', ageGroups: ['family'],
  difficulty: 'medium', questionAr: 'سؤال', questionEn: 'Question', answersAr: ['أ', 'ب'],
  answersEn: ['A', 'B'], correctAnswerIndex: 0, correctAnswerAr: 'أ', correctAnswerEn: 'A',
  points: 20, isKidsSafe: true, isActive: true, isPremium: false, ...overrides,
});

describe('question answer options', () => {
  test('classifies video before image and detects answer images', () => {
    expect(getQuestionMediaKind(question())).toBe('text');
    expect(getQuestionMediaKind(question({ revealImageUrl: 'answer.jpg' }))).toBe('image');
    expect(getQuestionMediaKind(question({ imageUrl: 'question.jpg', videoUrl: 'clip.mp4' }))).toBe('video');
  });

  test('uses the independent setting for the question media kind', () => {
    expect(areAnswerOptionsEnabled(question(), settings)).toBe(false);
    expect(areAnswerOptionsEnabled(question({ thumbnailUrl: 'thumb.jpg' }), settings)).toBe(true);
    expect(areAnswerOptionsEnabled(question({ mediaType: 'video' }), settings)).toBe(false);
  });

  test('returns an empty answer list for a manual question without options', () => {
    const manualQuestion = question({ answersAr: undefined, answersEn: undefined });

    expect(getQuestionAnswers(manualQuestion, 'ar')).toEqual([]);
    expect(getQuestionAnswers(manualQuestion, 'en')).toEqual([]);
  });
});