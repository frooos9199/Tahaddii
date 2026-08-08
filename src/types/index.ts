// ─── Question Types ───────────────────────────────────────────────────────────

export type QuestionType =
  | 'multiple_choice'
  | 'true_false'
  | 'direct'
  | 'image'
  | 'ordering'
  | 'complete'
  | 'who_am_i';

export type Difficulty = 'easy' | 'medium' | 'hard';

export type AgeGroup = 'kids5' | 'kids8' | 'kids11' | 'teens' | 'adults' | 'family';

export type CategoryId = string;

export interface CategoryCard {
  id: CategoryId;
  iconKey?: string;
  nameAr: string;
  nameEn: string;
  imageUrl: string;
  accentColor: string;
  sortOrder: number;
  isActive: boolean;
  questionTypes: QuestionType[];
  createdAtMs?: number;
  updatedAtMs?: number;
}

export type QuestionLanguage = 'ar' | 'en' | 'both' | 'mixed';

export interface Question {
  id: string;
  type: QuestionType;
  categoryId: CategoryId;
  linkedCategoryIds?: CategoryId[];
  ageGroups: AgeGroup[];
  difficulty: Difficulty;
  questionAr: string;
  questionEn: string;
  answersAr: string[];
  answersEn: string[];
  correctAnswerIndex?: number;
  correctAnswerAr: string;
  correctAnswerEn: string;
  explanationAr?: string;
  explanationEn?: string;
  hintAr?: string;
  hintEn?: string;
  imageUrl?: string;
  revealImageUrl?: string;
  thumbnailUrl?: string;
  videoUrl?: string;
  queueCategoryId?: CategoryId;
  mediaType?: 'image' | 'video';
  revealMode?: 'none' | 'blur' | 'crop' | 'mask';
  blurAmount?: number;
  points: number;
  timeLimit?: number;
  isKidsSafe: boolean;
  isActive: boolean;
  isPremium: boolean;
  source?: string;
}

// ─── Game Types ───────────────────────────────────────────────────────────────

export type GameMode =
  | 'solo'
  | 'group'
  | 'teams'
  | 'kids'
  | 'family'
  | 'speedChallenge'
  | 'allAnswer';

export type GameStatus = 'idle' | 'setup' | 'playing' | 'paused' | 'finished';

export interface Player {
  id: string;
  name: string;
  avatar: AvatarType;
  color: string;
  score: number;
  correctAnswers: number;
  wrongAnswers: number;
  totalAnswerTime: number;
  fastAnswers: number;
}

export interface Team {
  id: string;
  name: string;
  color: string;
  emoji: string;
  score: number;
  correctAnswers: number;
  wrongAnswers: number;
  players: string[];
}

export type AvatarType =
  | 'boy' | 'girl' | 'man' | 'woman'
  | 'lion' | 'tiger' | 'robot' | 'car' | 'ball' | 'star';

export interface GameSettings {
  mode: GameMode;
  ageGroup: AgeGroup;
  categories: CategoryId[];
  difficulty: Difficulty | 'progressive';
  questionCount: number;
  timePerQuestion: number;
  questionLanguage: QuestionLanguage;
  randomOrder: boolean;
  allowRepeat: boolean;
  soundEnabled: boolean;
  readQuestion: boolean;
  lifelines: LifelineSettings;
}

export interface LifelineSettings {
  enabled: boolean;
  fiftyFifty: number;
  extraTime: number;
  changeQuestion: number;
  hint: number;
}

export interface GameState {
  id: string;
  settings: GameSettings;
  players: Player[];
  teams: Team[];
  questions: Question[];
  currentQuestionIndex: number;
  currentPlayerIndex: number;
  tieBreakerPlayerIds?: string[];
  tieBreakerRound?: number;
  status: GameStatus;
  startedAt: number;
  usedQuestionIds: string[];
  lifelinesUsed: Record<string, Partial<LifelineSettings>>;
  answerHistory: AnswerRecord[];
}

export interface AnswerRecord {
  questionId: string;
  playerId: string;
  isCorrect: boolean;
  timeSpent: number;
  pointsEarned: number;
  lifelineUsed?: string;
}

// ─── Statistics Types ─────────────────────────────────────────────────────────

export interface GameResult {
  id: string;
  mode: GameMode;
  players: Pick<Player, 'id' | 'name' | 'score' | 'correctAnswers' | 'wrongAnswers'>[];
  winnerId: string;
  totalQuestions: number;
  categories: CategoryId[];
  difficulty: Difficulty | 'progressive';
  playedAt: number;
  duration: number;
}

export interface UserStats {
  totalGames: number;
  totalQuestions: number;
  correctAnswers: number;
  bestScore: number;
  longestStreak: number;
  avgAnswerTime: number;
  strongestCategory: CategoryId | null;
  weakestCategory: CategoryId | null;
  mostWins: string;
  recentGames: GameResult[];
  categoryStats: Record<CategoryId, { correct: number; total: number }>;
}

// ─── Online Multiplayer Types ────────────────────────────────────────────────

export type OnlineRoomStatus = 'lobby' | 'playing' | 'results' | 'ended';
export type OnlineRoomVisibility = 'private' | 'public' | 'nearby';

export interface OnlineRoomSettings {
  ageGroup: AgeGroup;
  categories: CategoryId[];
  difficulty: Difficulty | 'progressive';
  questionCount: number;
  timePerQuestion: number;
  questionLanguage: QuestionLanguage;
}

export interface OnlineRoom {
  id: string;
  code: string;
  hostId: string;
  hostName: string;
  status: OnlineRoomStatus;
  visibility: OnlineRoomVisibility;
  playerCount: number;
  maxPlayers: number;
  currentQuestionIndex: number;
  questionStartedAtMs: number | null;
  questionDurationMs: number;
  locked: boolean;
  winnerPlayerId: string | null;
  createdAtMs: number;
  expiresAtMs: number;
  settings: OnlineRoomSettings;
  currentQuestion: OnlineQuestion | null;
  answeredPlayerIds: string[];
  revealedAnswer: boolean;
  lastWrongAnswer: OnlineWrongAnswer | null;
  regionLabel?: string | null;
  location?: {
    latitude: number;
    longitude: number;
  } | null;
  distanceKm?: number | null;
}

export interface OnlinePlayer {
  id: string;
  name: string;
  score: number;
  connected: boolean;
  joinedAtMs: number;
}

export interface OnlinePresencePlayer {
  id: string;
  name: string;
  avatarEmoji: string;
  avatarUri?: string | null;
  color: string;
  lastSeenAtMs: number;
  activeUntilMs: number;
}

export interface OnlineWrongAnswer {
  id: string;
  playerId: string;
  playerName: string;
  answerText: string;
  questionIndex: number;
  createdAtMs: number;
}

export interface OnlineQuestion {
  id: string;
  prompt: string;
  answers: string[];
  correctAnswerIndex: number;
  points: number;
  explanation?: string;
}

// ─── Navigation Types ─────────────────────────────────────────────────────────

export type RootStackParamList = {
  Splash: undefined;
  Auth: undefined;
  Onboarding: undefined;
  LanguageSelect: undefined;
  Home: undefined;
  GameModeSelect: undefined;
  AddPlayers: undefined;
  AddTeams: undefined;
  AgeGroupSelect: undefined;
  CategorySelect: undefined;
  DifficultySelect: undefined;
  GameSetup: undefined;
  TvPairingScanner: undefined;
  Game: undefined;
  Pause: undefined;
  Results: undefined;
  Statistics: undefined;
  DailyChallenge: undefined;
  Settings: undefined;
  OnlinePlay: { roomCode?: string } | undefined;
  OnlineLobby: undefined;
  OnlineGame: undefined;
  AdminPanel: undefined;
  Profile: undefined;
  Privacy: undefined;
  Terms: undefined;
  Contact: undefined;
  NoInternet: undefined;
  ContinueGame: undefined;
};

// ─── User Profile ───────────────────────────────────────────────────────────

export interface UserProfile {
  name: string;
  avatarUri: string | null;  // local file URI
  avatarEmoji: string;       // fallback emoji
  color: string;
  createdAt: number;
}

export type AppUserRole = 'user' | 'admin' | 'super_admin';

export interface AppUserRecord {
  uid: string;
  email: string | null;
  displayName: string;
  avatarUri?: string | null;
  avatarEmoji?: string;
  color?: string;
  role: AppUserRole;
  roles: AppUserRole[];
  isAdmin: boolean;
  isSuperAdmin: boolean;
  isGuest: boolean;
  authProvider: 'anonymous' | 'password';
}

// ─── Daily Challenge ──────────────────────────────────────────────────────────

export interface DailyChallenge {
  date: string;
  questionIds: string[];
  completedAt?: number;
  score?: number;
  correctAnswers?: number;
}
