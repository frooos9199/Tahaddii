import { GameSettings, Question, QuestionLanguage } from '../types';

export type QuestionMediaKind = 'text' | 'image' | 'video';

export const getQuestionMediaKind = (question: Question): QuestionMediaKind => {
  if (question.mediaType === 'video' || question.videoUrl) return 'video';
  if (
    question.mediaType === 'image'
    || question.imageUrl
    || question.thumbnailUrl
    || question.revealImageUrl
  ) return 'image';
  return 'text';
};

export const areAnswerOptionsEnabled = (question: Question, settings: GameSettings): boolean => {
  const mediaKind = getQuestionMediaKind(question);
  if (mediaKind === 'video') return settings.showVideoAnswerOptions ?? false;
  if (mediaKind === 'image') return settings.showImageAnswerOptions ?? false;
  return settings.showTextAnswerOptions ?? false;
};

export const getQuestionAnswers = (
  question: Question,
  language: QuestionLanguage,
): string[] => {
  if (language === 'en') {
    return question.answersEn?.length ? question.answersEn : question.answersAr ?? [];
  }
  return question.answersAr?.length ? question.answersAr : question.answersEn ?? [];
};