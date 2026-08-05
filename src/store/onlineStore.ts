import { create } from 'zustand';
import { OnlinePlayer, OnlinePresencePlayer, OnlineRoom, OnlineRoomVisibility, UserProfile } from '../types';
import {
  advanceRoomQuestion,
  cleanupEndedOnlineRooms,
  createRoom,
  deleteRoom,
  ensureOnlineAuth,
  joinRoomById,
  joinRoomByCode,
  leaveRoom,
  revealRoomAnswer,
  startRoom,
  submitRoomAnswer,
  subscribeToOnlinePresence,
  subscribeToRoom,
  subscribeToPublicRooms,
  updateOnlinePresence,
} from '../services/online/onlineRoomService';
import { isFirebaseConfigured } from '../services/firebase/firebaseClient';
import { getCurrentCoordinates } from '../services/location/locationService';

interface OnlineStore {
  room: OnlineRoom | null;
  players: OnlinePlayer[];
  publicRooms: OnlineRoom[];
  onlinePlayers: OnlinePresencePlayer[];
  currentPlayerId: string | null;
  loading: boolean;
  error: string | null;
  firebaseReady: boolean;

  clearError: () => void;
  createOnlineRoom: (playerName: string, visibility: OnlineRoomVisibility, customRoomCode?: string) => Promise<void>;
  joinOnlineRoom: (roomCode: string, playerName: string) => Promise<void>;
  joinPublicOnlineRoom: (roomId: string, playerName: string) => Promise<void>;
  subscribeCurrentRoom: (roomId: string) => void;
  subscribeDiscoverableRooms: (profile?: UserProfile, fallbackName?: string) => Promise<void>;
  clearDiscoverableRooms: () => void;
  startCurrentRoom: () => Promise<void>;
  submitCurrentAnswer: (selectedAnswerIndex: number) => Promise<void>;
  revealCurrentAnswer: () => Promise<void>;
  advanceCurrentQuestion: () => Promise<void>;
  leaveCurrentRoom: () => Promise<void>;
  deleteCurrentRoom: () => Promise<void>;
}

let unsubscribeRoomListener: (() => void) | null = null;
let unsubscribePublicRoomsListener: (() => void) | null = null;
let unsubscribePresenceListener: (() => void) | null = null;
let presenceHeartbeat: ReturnType<typeof setInterval> | null = null;

const clearRoomListener = () => {
  if (unsubscribeRoomListener) {
    unsubscribeRoomListener();
    unsubscribeRoomListener = null;
  }
};

const clearPublicRoomsListener = () => {
  if (unsubscribePublicRoomsListener) {
    unsubscribePublicRoomsListener();
    unsubscribePublicRoomsListener = null;
  }
};

const clearPresenceListener = () => {
  if (unsubscribePresenceListener) {
    unsubscribePresenceListener();
    unsubscribePresenceListener = null;
  }
  if (presenceHeartbeat) {
    clearInterval(presenceHeartbeat);
    presenceHeartbeat = null;
  }
};

export const useOnlineStore = create<OnlineStore>((set, get) => ({
  room: null,
  players: [],
  publicRooms: [],
  onlinePlayers: [],
  currentPlayerId: null,
  loading: false,
  error: null,
  firebaseReady: isFirebaseConfigured(),

  clearError: () => set({ error: null }),

  createOnlineRoom: async (playerName, visibility, customRoomCode) => {
    set({ loading: true, error: null, firebaseReady: isFirebaseConfigured() });
    try {
      const result = await createRoom(playerName, visibility, customRoomCode);
      set({ currentPlayerId: result.playerId, loading: false });
      get().subscribeCurrentRoom(result.roomId);
    } catch (error) {
      set({ loading: false, error: error instanceof Error ? error.message : 'Failed to create room' });
    }
  },

  joinOnlineRoom: async (roomCode, playerName) => {
    set({ loading: true, error: null, firebaseReady: isFirebaseConfigured() });
    try {
      const result = await joinRoomByCode(roomCode, playerName);
      set({ currentPlayerId: result.playerId, loading: false });
      get().subscribeCurrentRoom(result.roomId);
    } catch (error) {
      set({ loading: false, error: error instanceof Error ? error.message : 'Failed to join room' });
    }
  },

  joinPublicOnlineRoom: async (roomId, playerName) => {
    set({ loading: true, error: null, firebaseReady: isFirebaseConfigured() });
    try {
      const result = await joinRoomById(roomId, playerName);
      set({ currentPlayerId: result.playerId, loading: false });
      get().subscribeCurrentRoom(result.roomId);
    } catch (error) {
      set({ loading: false, error: error instanceof Error ? error.message : 'Failed to join public room' });
    }
  },

  subscribeCurrentRoom: roomId => {
    clearRoomListener();
    unsubscribeRoomListener = subscribeToRoom(
      roomId,
      room => set({ room }),
      players => set({ players }),
    );
  },

  subscribeDiscoverableRooms: async (profile, fallbackName) => {
    set({ error: null });
    await ensureOnlineAuth();
    await cleanupEndedOnlineRooms().catch(() => {});
    const viewerLocation = await getCurrentCoordinates().catch(() => null);
    clearPublicRoomsListener();
    clearPresenceListener();
    if (profile) {
      await updateOnlinePresence(profile, fallbackName).catch(() => {});
      presenceHeartbeat = setInterval(() => {
        void updateOnlinePresence(profile, fallbackName).catch(() => {});
      }, 20 * 1000);
    }
    unsubscribePresenceListener = subscribeToOnlinePresence(
      onlinePlayers => set({ onlinePlayers }),
      error => set({ error: error.message || 'Failed to load online players' }),
    );
    unsubscribePublicRoomsListener = subscribeToPublicRooms(
      publicRooms => set({ publicRooms }),
      error => set({ error: error.message || 'Failed to load discoverable rooms' }),
      viewerLocation,
    );
  },

  clearDiscoverableRooms: () => {
    clearPublicRoomsListener();
    clearPresenceListener();
    set({ publicRooms: [], onlinePlayers: [] });
  },

  startCurrentRoom: async () => {
    const { room } = get();
    if (!room) {
      return;
    }

    set({ loading: true, error: null });
    try {
      await startRoom(room.id);
      set({ loading: false });
    } catch (error) {
      set({ loading: false, error: error instanceof Error ? error.message : 'Failed to start room' });
    }
  },

  submitCurrentAnswer: async selectedAnswerIndex => {
    const { room, currentPlayerId } = get();
    if (!room || !currentPlayerId) {
      return;
    }

    set({ error: null });
    try {
      await submitRoomAnswer(room.id, currentPlayerId, selectedAnswerIndex);
    } catch (error) {
      set({ error: error instanceof Error ? error.message : 'Failed to submit answer' });
    }
  },

  revealCurrentAnswer: async () => {
    const { room } = get();
    if (!room) {
      return;
    }

    set({ loading: true, error: null });
    try {
      await revealRoomAnswer(room.id);
      set({ loading: false });
    } catch (error) {
      set({ loading: false, error: error instanceof Error ? error.message : 'Failed to reveal answer' });
    }
  },

  advanceCurrentQuestion: async () => {
    const { room } = get();
    if (!room) {
      return;
    }

    set({ loading: true, error: null });
    try {
      await advanceRoomQuestion(room.id);
      set({ loading: false });
    } catch (error) {
      set({ loading: false, error: error instanceof Error ? error.message : 'Failed to advance question' });
    }
  },

  leaveCurrentRoom: async () => {
    const { room, currentPlayerId } = get();
    if (!room || !currentPlayerId) {
      clearRoomListener();
      set({ room: null, players: [], currentPlayerId: null, loading: false });
      return;
    }

    set({ loading: true, error: null });
    try {
      await leaveRoom(room.id, currentPlayerId);
      clearRoomListener();
      set({ room: null, players: [], currentPlayerId: null, loading: false });
    } catch (error) {
      set({ loading: false, error: error instanceof Error ? error.message : 'Failed to leave room' });
    }
  },

  deleteCurrentRoom: async () => {
    const { room } = get();
    if (!room) {
      clearRoomListener();
      set({ room: null, players: [], currentPlayerId: null, loading: false });
      return;
    }

    set({ loading: true, error: null });
    try {
      await deleteRoom(room.id);
      clearRoomListener();
      set({ room: null, players: [], currentPlayerId: null, loading: false });
    } catch (error) {
      set({ loading: false, error: error instanceof Error ? error.message : 'Failed to delete room' });
    }
  },
}));