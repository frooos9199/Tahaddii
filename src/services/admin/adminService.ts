import {
  collection,
  getDocs,
  orderBy,
  query,
} from 'firebase/firestore';
import { AppUserRecord, OnlineRoom } from '../../types';
import { getFirebaseDb, isFirebaseConfigured } from '../firebase/firebaseClient';
import { deleteRoom as deleteOnlineRoom } from '../online/onlineRoomService';

const USERS_COLLECTION = 'users';
const ROOMS_COLLECTION = 'rooms';

const mapRoom = (roomId: string, payload: any): OnlineRoom => ({
  id: roomId,
  code: payload.code,
  hostId: payload.hostId,
  hostName: payload.hostName,
  status: payload.status,
  visibility: payload.visibility ?? 'private',
  playerCount: payload.playerCount ?? 0,
  maxPlayers: payload.maxPlayers ?? 8,
  currentQuestionIndex: payload.currentQuestionIndex ?? 0,
  questionStartedAtMs: payload.questionStartedAtMs ?? null,
  questionDurationMs: payload.questionDurationMs ?? 0,
  locked: payload.locked ?? false,
  winnerPlayerId: payload.winnerPlayerId ?? null,
  createdAtMs: payload.createdAtMs ?? 0,
  expiresAtMs: payload.expiresAtMs ?? 0,
  settings: payload.settings,
  currentQuestion: payload.currentQuestion ?? null,
  answeredPlayerIds: payload.answeredPlayerIds ?? [],
  revealedAnswer: payload.revealedAnswer ?? false,
  lastWrongAnswer: payload.lastWrongAnswer ?? null,
  regionLabel: payload.regionLabel ?? null,
});

export const listAppUsers = async (): Promise<AppUserRecord[]> => {
  if (!isFirebaseConfigured()) {
    return [];
  }

  const db = getFirebaseDb();
  const usersQuery = query(collection(db, USERS_COLLECTION), orderBy('displayName', 'asc'));
  const snapshot = await getDocs(usersQuery);

  return snapshot.docs.map(userDoc => {
    const data = userDoc.data();
    return {
      uid: userDoc.id,
      email: data.email ?? null,
      displayName: data.displayName ?? 'User',
      role: data.role ?? 'user',
      roles: Array.isArray(data.roles) && data.roles.length ? data.roles : [data.role ?? 'user'],
      isAdmin: Boolean(data.isAdmin),
      isSuperAdmin: Boolean(data.isSuperAdmin),
      isGuest: Boolean(data.isGuest),
      authProvider: data.authProvider === 'password' ? 'password' : 'anonymous',
    } satisfies AppUserRecord;
  });
};

export const listActiveRooms = async (): Promise<OnlineRoom[]> => {
  if (!isFirebaseConfigured()) {
    return [];
  }

  const db = getFirebaseDb();
  const roomsQuery = query(collection(db, ROOMS_COLLECTION), orderBy('createdAtMs', 'desc'));
  const snapshot = await getDocs(roomsQuery);

  return snapshot.docs.map(roomDoc => mapRoom(roomDoc.id, roomDoc.data()));
};

export const adminDeleteRoom = async (roomId: string) => {
  await deleteOnlineRoom(roomId);
};