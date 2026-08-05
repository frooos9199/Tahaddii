import { create } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  GameState, GameSettings, Player, Team, Question,
  AnswerRecord, AvatarType,
} from '../types';
import { generateId } from '../utils/helpers';

const SAVED_GAME_KEY = 'savedGame';

const defaultSettings: GameSettings = {
  mode: 'group',
  ageGroup: 'family',
  categories: [],
  difficulty: 'progressive',
  questionCount: 10,
  timePerQuestion: 15,
  questionLanguage: 'ar',
  randomOrder: false,
  allowRepeat: false,
  soundEnabled: true,
  readQuestion: false,
  lifelines: { enabled: true, fiftyFifty: 1, extraTime: 1, changeQuestion: 1, hint: 1 },
};

interface GameStore {
  game: GameState | null;
  settings: GameSettings;
  pendingTvDisplayCode: string | null;

  // Settings actions
  updateSettings: (s: Partial<GameSettings>) => void;
  resetSettings: () => void;
  setPendingTvDisplayCode: (code: string | null) => void;

  // Player actions
  addPlayer: (name: string, avatar: AvatarType, color: string) => void;
  removePlayer: (id: string) => void;
  updatePlayer: (id: string, data: Partial<Player>) => void;
  reorderPlayers: (players: Player[]) => void;

  // Team actions
  addTeam: (name: string, color: string, emoji: string) => void;
  removeTeam: (id: string) => void;
  updateTeam: (id: string, data: Partial<Team>) => void;

  // Game actions
  initGame: (questions: Question[]) => void;
  startGame: () => void;
  pauseGame: () => void;
  resumeGame: () => void;
  submitAnswer: (record: AnswerRecord) => void;
  nextQuestion: () => void;
  startTieBreaker: (playerIds: string[], questions: Question[]) => void;
  finishGame: () => void;
  resetGame: () => void;

  // Persistence
  saveGame: () => Promise<void>;
  loadSavedGame: () => Promise<boolean>;
  clearSavedGame: () => Promise<void>;

  // Temp players list (before game starts)
  pendingPlayers: Player[];
  pendingTeams: Team[];
  setPendingPlayers: (players: Player[]) => void;
  setPendingTeams: (teams: Team[]) => void;
}

export const useGameStore = create<GameStore>((set, get) => ({
  game: null,
  settings: defaultSettings,
  pendingTvDisplayCode: null,
  pendingPlayers: [],
  pendingTeams: [],

  updateSettings: (s) => set(state => ({ settings: { ...state.settings, ...s } })),
  resetSettings: () => set({ settings: defaultSettings }),
  setPendingTvDisplayCode: (code) => set({ pendingTvDisplayCode: code }),

  setPendingPlayers: (players) => set({ pendingPlayers: players }),
  setPendingTeams: (teams) => set({ pendingTeams: teams }),

  addPlayer: (name, avatar, color) => {
    const player: Player = {
      id: generateId(),
      name, avatar, color,
      score: 0, correctAnswers: 0, wrongAnswers: 0,
      totalAnswerTime: 0, fastAnswers: 0,
    };
    set(state => ({ pendingPlayers: [...state.pendingPlayers, player] }));
  },

  removePlayer: (id) =>
    set(state => ({ pendingPlayers: state.pendingPlayers.filter(p => p.id !== id) })),

  updatePlayer: (id, data) =>
    set(state => ({
      pendingPlayers: state.pendingPlayers.map(p => p.id === id ? { ...p, ...data } : p),
    })),

  reorderPlayers: (players) => set({ pendingPlayers: players }),

  addTeam: (name, color, emoji) => {
    const team: Team = {
      id: generateId(),
      name, color, emoji,
      score: 0, correctAnswers: 0, wrongAnswers: 0, players: [],
    };
    set(state => ({ pendingTeams: [...state.pendingTeams, team] }));
  },

  removeTeam: (id) =>
    set(state => ({ pendingTeams: state.pendingTeams.filter(t => t.id !== id) })),

  updateTeam: (id, data) =>
    set(state => ({
      pendingTeams: state.pendingTeams.map(t => t.id === id ? { ...t, ...data } : t),
    })),

  initGame: (questions) => {
    const { settings, pendingPlayers, pendingTeams } = get();
    const players = settings.randomOrder
      ? [...pendingPlayers].sort(() => Math.random() - 0.5)
      : pendingPlayers;

    const game: GameState = {
      id: generateId(),
      settings,
      players,
      teams: pendingTeams,
      questions,
      currentQuestionIndex: 0,
      currentPlayerIndex: 0,
      status: 'setup',
      startedAt: Date.now(),
      usedQuestionIds: questions.map(q => q.id),
      lifelinesUsed: {},
      answerHistory: [],
    };
    set({ game });
  },

  startGame: () =>
    set(state => ({
      game: state.game ? { ...state.game, status: 'playing' } : null,
    })),

  pauseGame: () =>
    set(state => ({
      game: state.game ? { ...state.game, status: 'paused' } : null,
    })),

  resumeGame: () =>
    set(state => ({
      game: state.game ? { ...state.game, status: 'playing' } : null,
    })),

  submitAnswer: (record) => {
    const { game } = get();
    if (!game) return;

    const updatedPlayers = game.players.map(p => {
      if (p.id !== record.playerId) return p;
      return {
        ...p,
        score: p.score + record.pointsEarned,
        correctAnswers: p.correctAnswers + (record.isCorrect ? 1 : 0),
        wrongAnswers: p.wrongAnswers + (record.isCorrect ? 0 : 1),
        totalAnswerTime: p.totalAnswerTime + record.timeSpent,
        fastAnswers: p.fastAnswers + (record.pointsEarned > game.questions[game.currentQuestionIndex]?.points ? 1 : 0),
      };
    });

    const updatedTeams = game.teams.map(t => {
      if (!t.players.includes(record.playerId)) return t;
      return {
        ...t,
        score: t.score + record.pointsEarned,
        correctAnswers: t.correctAnswers + (record.isCorrect ? 1 : 0),
        wrongAnswers: t.wrongAnswers + (record.isCorrect ? 0 : 1),
      };
    });

    set({
      game: {
        ...game,
        players: updatedPlayers,
        teams: updatedTeams,
        answerHistory: [...game.answerHistory, record],
      },
    });
  },

  nextQuestion: () => {
    const { game } = get();
    if (!game) return;

    const nextIndex = game.currentQuestionIndex + 1;
    const isFinished = nextIndex >= game.questions.length;

    if (isFinished) {
      set({ game: { ...game, status: 'finished' } });
      get().clearSavedGame();
      return;
    }

    const activePlayerIds = game.tieBreakerPlayerIds?.length ? game.tieBreakerPlayerIds : null;
    const currentPlayerId = game.players[game.currentPlayerIndex]?.id;
    const currentActiveIndex = activePlayerIds ? activePlayerIds.indexOf(currentPlayerId) : -1;
    const nextActivePlayerId = activePlayerIds
      ? activePlayerIds[(Math.max(0, currentActiveIndex) + 1) % activePlayerIds.length]
      : null;
    const nextPlayerIndex = nextActivePlayerId
      ? Math.max(0, game.players.findIndex(player => player.id === nextActivePlayerId))
      : (game.currentPlayerIndex + 1) % game.players.length;
    set({
      game: {
        ...game,
        currentQuestionIndex: nextIndex,
        currentPlayerIndex: nextPlayerIndex,
        status: 'playing',
      },
    });
    get().saveGame();
  },

  startTieBreaker: (playerIds, questions) => {
    const { game } = get();
    if (!game || questions.length === 0 || playerIds.length < 2) return;

    const firstPlayerIndex = game.players.findIndex(player => player.id === playerIds[0]);
    set({
      game: {
        ...game,
        questions: [...game.questions, ...questions],
        currentQuestionIndex: game.currentQuestionIndex + 1,
        currentPlayerIndex: firstPlayerIndex >= 0 ? firstPlayerIndex : game.currentPlayerIndex,
        tieBreakerPlayerIds: playerIds,
        tieBreakerRound: (game.tieBreakerRound ?? 0) + 1,
        usedQuestionIds: [...game.usedQuestionIds, ...questions.map(question => question.id)],
        status: 'playing',
      },
    });
    get().saveGame();
  },

  finishGame: () =>
    set(state => ({
      game: state.game ? { ...state.game, tieBreakerPlayerIds: undefined, status: 'finished' } : null,
    })),

  resetGame: () => set({
    game: null,
    pendingPlayers: [],
    pendingTeams: [],
    pendingTvDisplayCode: null,
  }),

  saveGame: async () => {
    const { game } = get();
    if (game && game.status === 'playing') {
      await AsyncStorage.setItem(SAVED_GAME_KEY, JSON.stringify(game));
    }
  },

  loadSavedGame: async () => {
    try {
      const saved = await AsyncStorage.getItem(SAVED_GAME_KEY);
      if (saved) {
        const game: GameState = JSON.parse(saved);
        set({ game });
        return true;
      }
    } catch {}
    return false;
  },

  clearSavedGame: async () => {
    await AsyncStorage.removeItem(SAVED_GAME_KEY);
  },
}));
