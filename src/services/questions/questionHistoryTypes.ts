import { CategoryId } from '../../types';

export type QuestionHistoryEntry = {
  questionId: string;
  categoryId?: CategoryId;
  lastSeenAt: number;
  seenCount: number;
};

export type QuestionHistoryState = {
  entries: Record<string, QuestionHistoryEntry>;
  recentQuestionIds: string[];
  pendingSyncQuestionIds: string[];
  updatedAtMs: number;
};

export const EMPTY_QUESTION_HISTORY: QuestionHistoryState = {
  entries: {},
  recentQuestionIds: [],
  pendingSyncQuestionIds: [],
  updatedAtMs: 0,
};