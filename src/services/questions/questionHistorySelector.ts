import { Question } from '../../types';
import { shuffle } from '../../utils/helpers';
import { QuestionHistoryState } from './questionHistoryTypes';

export const getUnseenQuestions = (questions: Question[], history: QuestionHistoryState) => (
  questions.filter(question => !history.entries[question.id])
);

export const getOldestSeenQuestions = (questions: Question[], history: QuestionHistoryState) => (
  questions
    .filter(question => Boolean(history.entries[question.id]))
    .sort((left, right) => {
      const leftEntry = history.entries[left.id];
      const rightEntry = history.entries[right.id];
      return (leftEntry?.lastSeenAt ?? 0) - (rightEntry?.lastSeenAt ?? 0)
        || (leftEntry?.seenCount ?? 0) - (rightEntry?.seenCount ?? 0)
        || Math.random() - 0.5;
    })
);

export const getRecentQuestionIds = (history: QuestionHistoryState) => new Set(history.recentQuestionIds);

export const selectQuestionsWithHistory = ({
  questions,
  requiredCount,
  history,
}: {
  questions: Question[];
  requiredCount: number;
  history: QuestionHistoryState;
}) => {
  if (requiredCount <= 0 || questions.length === 0) return [];

  const recentQuestionIds = getRecentQuestionIds(history);
  const unseenQuestions = getUnseenQuestions(questions, history);
  const seenQuestions = getOldestSeenQuestions(questions, history);
  const buckets = [
    shuffle(unseenQuestions.filter(question => !recentQuestionIds.has(question.id))),
    shuffle(unseenQuestions.filter(question => recentQuestionIds.has(question.id))),
    seenQuestions.filter(question => !recentQuestionIds.has(question.id)),
    seenQuestions.filter(question => recentQuestionIds.has(question.id)),
  ];
  const selectedQuestions: Question[] = [];
  const selectedQuestionIds = new Set<string>();

  buckets.forEach(bucket => {
    bucket.forEach(question => {
      if (selectedQuestions.length >= requiredCount || selectedQuestionIds.has(question.id)) return;
      selectedQuestionIds.add(question.id);
      selectedQuestions.push(question);
    });
  });

  return selectedQuestions;
};