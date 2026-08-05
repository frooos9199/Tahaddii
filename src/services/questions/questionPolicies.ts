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

export const CATEGORY_POLICY_BY_ID: Record<CategoryId, keyof typeof CATEGORY_AGE_POLICIES> = {
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
  const policyName = CATEGORY_POLICY_BY_ID[categoryId];
  return [...CATEGORY_AGE_POLICIES[policyName][ageGroup]];
};

export const canQuestionAppearForAge = (question: Question, ageGroup: AgeGroup) => {
  const allowedDifficulties = getAllowedDifficultiesForCategoryAge(question.categoryId, ageGroup);

  if (!question.ageGroups.includes(ageGroup)) {
    return false;
  }

  if ((ageGroup === 'family' || KIDS_AGE_GROUPS.includes(ageGroup)) && !question.isKidsSafe) {
    return false;
  }

  if (!(AGE_DIFFICULTY_RULES[ageGroup] as readonly string[]).includes(question.difficulty)) {
    return false;
  }

  return (allowedDifficulties as readonly string[]).includes(question.difficulty);
};