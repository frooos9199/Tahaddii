import { AgeGroup, CategoryId, Difficulty, Question } from '../../types';

export const KIDS_AGE_GROUPS: AgeGroup[] = ['kids5', 'kids8', 'kids11'];

export const AGE_DIFFICULTY_RULES = {
  kids5: ['easy'],
  kids8: ['easy', 'medium'],
  kids11: ['easy', 'medium', 'hard'],
  teens: ['easy', 'medium', 'hard'],
  adults: ['medium', 'hard'],
  family: ['easy', 'medium', 'hard'],
} as const;

export const CATEGORY_AGE_POLICIES = {
  broadKids: {
    kids5: ['easy'],
    kids8: ['easy'],
    kids11: ['easy', 'medium'],
    teens: ['easy', 'medium', 'hard'],
    adults: ['medium', 'hard'],
    family: ['easy', 'medium'],
  },
  youthGeneral: {
    kids5: [],
    kids8: ['easy'],
    kids11: ['easy', 'medium'],
    teens: ['easy', 'medium', 'hard'],
    adults: ['medium', 'hard'],
    family: ['easy', 'medium'],
  },
  preteenUp: {
    kids5: [],
    kids8: [],
    kids11: ['easy'],
    teens: ['easy', 'medium', 'hard'],
    adults: ['medium', 'hard'],
    family: [],
  },
  olderOnly: {
    kids5: [],
    kids8: [],
    kids11: [],
    teens: ['easy', 'medium'],
    adults: ['medium', 'hard'],
    family: [],
  },
  familyPlay: {
    kids5: ['easy'],
    kids8: ['easy', 'medium'],
    kids11: ['easy', 'medium'],
    teens: ['easy', 'medium', 'hard'],
    adults: ['medium', 'hard'],
    family: ['easy', 'medium'],
  },
} satisfies Record<string, Record<AgeGroup, Difficulty[]>>;

export const CATEGORY_POLICY_BY_ID: Record<string, keyof typeof CATEGORY_AGE_POLICIES> = {
  generalKnowledge: 'broadKids',
  sports: 'youthGeneral',
  football: 'youthGeneral',
  cars: 'youthGeneral',
  movies: 'olderOnly',
  cartoons: 'broadKids',
  anime: 'olderOnly',
  history: 'youthGeneral',
  geography: 'youthGeneral',
  science: 'youthGeneral',
  space: 'youthGeneral',
  animals: 'broadKids',
  capitals: 'youthGeneral',
  riddles: 'broadKids',
  math: 'broadKids',
  arabicLang: 'preteenUp',
  englishLang: 'preteenUp',
  technology: 'olderOnly',
  inventions: 'preteenUp',
  celebrities: 'olderOnly',
  music: 'youthGeneral',
  islamicCulture: 'broadKids',
  kuwait: 'broadKids',
  flags: 'youthGeneral',
  guessImage: 'broadKids',
  trueFalse: 'broadKids',
  completeSentence: 'youthGeneral',
  whoAmI: 'broadKids',
  wouldYouRather: 'familyPlay',
  familyChallenges: 'familyPlay',
};

export const getAllowedDifficultiesForCategoryAge = (categoryId: CategoryId, ageGroup: AgeGroup): Difficulty[] => {
  const policyName = CATEGORY_POLICY_BY_ID[categoryId] || 'youthGeneral';
  return [...CATEGORY_AGE_POLICIES[policyName][ageGroup]];
};

export const DIFFICULTY_MIX: Record<Difficulty | 'progressive', Difficulty[]> = {
  easy: ['easy', 'easy', 'easy', 'medium'],
  medium: ['medium', 'medium', 'medium', 'easy', 'hard'],
  hard: ['hard', 'hard', 'hard', 'medium'],
  progressive: ['easy', 'medium', 'hard'],
};

export const getAllowedDifficultiesForLevel = (difficulty: Difficulty | 'progressive'): Difficulty[] =>
  [...new Set(DIFFICULTY_MIX[difficulty])];

export const canQuestionAppearForDifficulty = (question: Question, difficulty: Difficulty | 'progressive') =>
  getAllowedDifficultiesForLevel(difficulty).includes(question.difficulty);

export const canQuestionAppearForAge = (_question: Question, _ageGroup: AgeGroup) => true;