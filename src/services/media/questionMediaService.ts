import { Image } from 'react-native';
import { Question } from '../../types';

const preloadedUrls = new Set<string>();

const uniqueCleanUrls = (urls: Array<string | undefined>) => urls
  .map(url => String(url || '').trim())
  .filter((url, index, cleanUrls): url is string => Boolean(url) && cleanUrls.indexOf(url) === index);

export const getQuestionImageUrls = (question?: Pick<Question, 'imageUrl' | 'revealImageUrl' | 'thumbnailUrl'> | null) => {
  if (!question) return [];

  return uniqueCleanUrls([question.thumbnailUrl, question.imageUrl, question.revealImageUrl]);
};

export const getQuestionDisplayImageUrls = (question?: Pick<Question, 'imageUrl' | 'revealImageUrl' | 'thumbnailUrl'> | null, revealed = false) => {
  if (!question) return [];

  return revealed
    ? uniqueCleanUrls([question.revealImageUrl, question.imageUrl, question.thumbnailUrl])
    : uniqueCleanUrls([question.imageUrl, question.thumbnailUrl, question.revealImageUrl]);
};

export const getQuestionPrimaryImageUrl = (question?: Pick<Question, 'imageUrl' | 'revealImageUrl' | 'thumbnailUrl'> | null, revealed = false) => {
  return getQuestionDisplayImageUrls(question, revealed)[0] || '';
};

export const preloadImageUrl = async (url: string) => {
  const cleanUrl = url.trim();
  if (!cleanUrl || preloadedUrls.has(cleanUrl)) return false;

  preloadedUrls.add(cleanUrl);
  try {
    await Image.prefetch(cleanUrl);
    return true;
  } catch {
    preloadedUrls.delete(cleanUrl);
    return false;
  }
};

export const preloadQuestionMedia = async (question?: Question | null) => {
  await Promise.all(getQuestionImageUrls(question).map(preloadImageUrl));
};

export const preloadUpcomingQuestionMedia = (questions: Question[], currentIndex: number, windowSize = 4) => {
  questions
    .slice(currentIndex, currentIndex + windowSize)
    .forEach(question => {
      void preloadQuestionMedia(question);
    });
};
