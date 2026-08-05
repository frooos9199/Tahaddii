import { addDoc, collection, doc, getDocs, orderBy, query, serverTimestamp, setDoc } from 'firebase/firestore';
import { AgeGroup, CategoryId, Difficulty, Question } from '../../types';
import { DIFFICULTY_POINTS } from '../../constants';
import { getFirebaseDb, isFirebaseConfigured } from '../firebase/firebaseClient';

const CUSTOM_QUESTIONS_COLLECTION = 'customQuestions';

export interface CustomQuestionInput {
  id?: string;
  categoryId: CategoryId;
  difficulty: Difficulty;
  questionAr: string;
  answersAr: string[];
  correctAnswerIndex: number;
  ageGroups?: AgeGroup[];
  questionEn?: string;
  answersEn?: string[];
  explanationAr?: string;
}

const toQuestion = (questionId: string, payload: any): Question => {
  const answersAr = Array.isArray(payload.answersAr) ? payload.answersAr : [];
  const answersEn = Array.isArray(payload.answersEn) && payload.answersEn.length ? payload.answersEn : answersAr;
  const correctAnswerIndex = payload.correctAnswerIndex ?? 0;
  const difficulty = payload.difficulty as Difficulty;

  return {
    id: questionId,
    type: 'multiple_choice',
    categoryId: payload.categoryId as CategoryId,
    ageGroups: Array.isArray(payload.ageGroups) && payload.ageGroups.length
      ? payload.ageGroups
      : ['kids5', 'kids8', 'kids11', 'teens', 'adults', 'family'],
    difficulty,
    questionAr: payload.questionAr ?? '',
    questionEn: payload.questionEn || payload.questionAr || '',
    answersAr,
    answersEn,
    correctAnswerIndex,
    correctAnswerAr: answersAr[correctAnswerIndex] ?? '',
    correctAnswerEn: answersEn[correctAnswerIndex] ?? answersAr[correctAnswerIndex] ?? '',
    explanationAr: payload.explanationAr || undefined,
    points: DIFFICULTY_POINTS[difficulty] ?? DIFFICULTY_POINTS.easy,
    isKidsSafe: payload.isKidsSafe ?? true,
    isActive: payload.isActive ?? true,
    isPremium: false,
    source: 'admin',
  };
};

export const listCustomQuestions = async (): Promise<Question[]> => {
  if (!isFirebaseConfigured()) {
    return [];
  }

  const db = getFirebaseDb();
  const questionsQuery = query(collection(db, CUSTOM_QUESTIONS_COLLECTION), orderBy('createdAtMs', 'desc'));
  const snapshot = await getDocs(questionsQuery);
  return snapshot.docs.map(questionDoc => toQuestion(questionDoc.id, questionDoc.data()));
};

export const addCustomQuestion = async (input: CustomQuestionInput) => {
  const questionAr = input.questionAr.trim();
  const answersAr = input.answersAr.map(answer => answer.trim()).filter(Boolean);

  if (!questionAr) {
    throw new Error('اكتب نص السؤال');
  }

  if (answersAr.length < 2) {
    throw new Error('أضف اختيارين على الأقل');
  }

  if (input.correctAnswerIndex < 0 || input.correctAnswerIndex >= answersAr.length) {
    throw new Error('اختر الإجابة الصحيحة');
  }

  const answersEn = input.answersEn?.map(answer => answer.trim()).filter(Boolean);
  const db = getFirebaseDb();
  const now = Date.now();

  const payload = {
    categoryId: input.categoryId,
    difficulty: input.difficulty,
    questionAr,
    questionEn: input.questionEn?.trim() || questionAr,
    answersAr,
    answersEn: answersEn?.length === answersAr.length ? answersEn : answersAr,
    correctAnswerIndex: input.correctAnswerIndex,
    ageGroups: input.ageGroups?.length ? input.ageGroups : ['kids5', 'kids8', 'kids11', 'teens', 'adults', 'family'],
    explanationAr: input.explanationAr?.trim() || null,
    isKidsSafe: true,
    isActive: true,
    createdAtMs: now,
    updatedAtMs: now,
    createdAt: serverTimestamp(),
  };

  if (input.id) {
    await setDoc(doc(db, CUSTOM_QUESTIONS_COLLECTION, input.id), payload, { merge: true });
    return input.id;
  }

  const docRef = await addDoc(collection(db, CUSTOM_QUESTIONS_COLLECTION), payload);

  return docRef.id;
};