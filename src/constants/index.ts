import { CategoryId, AvatarType } from '../types';

export const PLAYER_COLORS = [
  '#7C3AED', '#2563EB', '#10B981', '#F59E0B',
  '#EF4444', '#EC4899', '#06B6D4', '#84CC16',
  '#F97316', '#8B5CF6', '#14B8A6', '#F43F5E',
];

export const TEAM_EMOJIS = ['🦁', '🐯', '🦊', '🐺', '🦅', '🐉', '⚡', '🔥'];

export const AVATARS: AvatarType[] = [
  'boy', 'girl', 'man', 'woman',
  'lion', 'tiger', 'robot', 'car', 'ball', 'star',
];

export const AVATAR_EMOJIS: Record<AvatarType, string> = {
  boy: '👦', girl: '👧', man: '👨', woman: '👩',
  lion: '🦁', tiger: '🐯', robot: '🤖', car: '🚗', ball: '⚽', star: '⭐',
};

export const CATEGORY_EMOJIS: Record<CategoryId, string> = {
  generalKnowledge: '🧠', sports: '🏅', football: '⚽', cars: '🚗',
  movies: '🎬', cartoons: '🎨', anime: '⛩️', history: '📜',
  geography: '🌍', science: '🔬', space: '🚀', animals: '🦁',
  capitals: '🏛️', riddles: '🧩', math: '🔢', arabicLang: '📖',
  englishLang: '🔤', technology: '💻', inventions: '💡', celebrities: '⭐',
  music: '🎵', islamicCulture: '☪️', kuwait: '🇰🇼', flags: '🏳️',
  guessImage: '🖼️', trueFalse: '✅', completeSentence: '📝',
  whoAmI: '🎭', wouldYouRather: '🤔', familyChallenges: '👨‍👩‍👧‍👦',
};

export const DIFFICULTY_POINTS = { easy: 10, medium: 20, hard: 30 };
export const FAST_ANSWER_BONUS = 5;
export const LIFELINE_PENALTY = 0.5;

export const QUESTION_COUNT_OPTIONS = [5, 10, 15, 20];
export const TIME_OPTIONS = [0, 5, 10, 15, 20, 30];

export const MAX_PLAYERS = 12;
export const MIN_PLAYERS_GROUP = 2;
export const MAX_TEAMS = 4;
export const MIN_TEAMS = 2;

export const KIDS_AGE_GROUPS = ['kids5', 'kids8', 'kids11'];
