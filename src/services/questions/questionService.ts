import { Question, GameSettings } from '../../types';
import { shuffle } from '../../utils/helpers';
import { getQuestionCategoryIds, mergeQuestionBank, questionBelongsToAnyCategory } from './questionCatalog';
import { listCustomQuestions } from './customQuestionService';
import { listCategoryCards } from '../categories/categoryCardService';
import { buildSmartMixedQuestionQueue } from './questionQueue';
import { getQuestionHistory } from './questionHistoryService';
import { EMPTY_QUESTION_HISTORY } from './questionHistoryTypes';

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
  const { categories, questionCount, questionLanguage, allowRepeat } = settings;
  const customQuestions = await listCustomQuestions().catch(() => []);
  const allQuestions = mergeQuestionBank(customQuestions);
  const publishedCategoryCards = await listCategoryCards({ includeInactive: true }).catch(() => []);
  const hasPublishedCategoryConfig = publishedCategoryCards.length > 0;
  const enabledCategoryIds = new Set(publishedCategoryCards.filter(card => card.isActive).map(card => card.id));
  const categoriesWithQuestions = [...new Set(allQuestions.filter(question => question.isActive).flatMap(getQuestionCategoryIds))];
  const requestedCategories = categories.length ? categories : categoriesWithQuestions;
  const enabledRequestedCategories = requestedCategories.filter(categoryId => !hasPublishedCategoryConfig || enabledCategoryIds.has(categoryId));
  const activeCategories = enabledRequestedCategories.length
    ? enabledRequestedCategories
    : requestedCategories.length && hasPublishedCategoryConfig
      ? []
      : requestedCategories.length
        ? requestedCategories
        : categoriesWithQuestions;

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
    if (!questionBelongsToAnyCategory(q, activeCategories)) return false;
    if (!matchesLanguage(q)) return false;
    return true;
  });

  if (pool.length === 0) {
    pool = allQuestions.filter(q =>
      q.isActive &&
      questionBelongsToAnyCategory(q, activeCategories) &&
      matchesLanguage(q),
    );
  }

  const history = !allowRepeat && pool.length > 0 ? await getQuestionHistory() : EMPTY_QUESTION_HISTORY;
  const selected = buildSmartMixedQuestionQueue({
    pool,
    categoryIds: activeCategories,
    questionCount,
    history,
  });

  const queuedSelection = selected.map(shuffleQuestionAnswers);

  return queuedSelection;
}
