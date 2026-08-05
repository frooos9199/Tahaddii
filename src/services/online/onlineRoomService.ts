import {
  addDoc,
  collection,
  doc,
  getDoc,
  getDocs,
  limit,
  onSnapshot,
  orderBy,
  query,
  runTransaction as runFirestoreTransaction,
  setDoc,
  updateDoc,
  where,
  writeBatch,
} from 'firebase/firestore';
import { onValue, ref, runTransaction as runRealtimeTransaction, set } from 'firebase/database';
import { httpsCallable } from 'firebase/functions';
import { OnlinePlayer, OnlinePresencePlayer, OnlineQuestion, OnlineRoom, OnlineRoomSettings, OnlineRoomVisibility, Question, UserProfile } from '../../types';
import { getFirebaseDb, getFirebaseFunctions, getFirebaseRealtimeDb } from '../firebase/firebaseClient';
import { ensureAuthenticatedUser } from '../auth/authService';
import { getQuestions } from '../questions/questionService';
import { getAvailableQuestionCountFromBank, getRecommendedFairQuestionCount, loadQuestionBank } from '../questions/questionCatalog';
import { Coordinates, NEARBY_ROOM_RADIUS_KM, getCurrentCoordinates, getDistanceKm } from '../location/locationService';

const ROOM_TTL_MS = 3 * 24 * 60 * 60 * 1000;
const STALE_PLAYING_ROOM_MS = 30 * 60 * 1000;
const ROOMS_COLLECTION = 'rooms';
const PLAYERS_SUBCOLLECTION = 'players';
const ONLINE_PRESENCE_COLLECTION = 'onlinePresence';
const LIVE_ROOMS_PATH = 'onlineRoomStates';
const ONLINE_PRESENCE_TTL_MS = 45 * 1000;

const generateRoomCode = () => Math.random().toString(36).slice(2, 8).toUpperCase();
const normalizeRoomCode = (roomCode: string) => roomCode.trim().replace(/\s+/g, '').toUpperCase();
const isValidRoomCode = (roomCode: string) => /^[A-Z0-9]{4,10}$/.test(roomCode);

type OnlineLiveRoomState = Pick<OnlineRoom, 'locked' | 'winnerPlayerId' | 'revealedAnswer' | 'lastWrongAnswer'> & {
  currentQuestionIndex: number;
  updatedAtMs: number;
};

const getLiveRoomStateRef = (roomId: string) => ref(getFirebaseRealtimeDb(), `${LIVE_ROOMS_PATH}/${roomId}`);

const createOpenLiveRoomState = (currentQuestionIndex: number): OnlineLiveRoomState => ({
  currentQuestionIndex,
  locked: false,
  winnerPlayerId: null,
  revealedAnswer: false,
  lastWrongAnswer: null,
  updatedAtMs: Date.now(),
});

const mergeLiveRoomState = (room: OnlineRoom, liveState: OnlineLiveRoomState | null): OnlineRoom => {
  if (!liveState || liveState.currentQuestionIndex !== room.currentQuestionIndex) {
    return room;
  }

  return {
    ...room,
    locked: liveState.locked,
    winnerPlayerId: liveState.winnerPlayerId,
    revealedAnswer: liveState.revealedAnswer,
    lastWrongAnswer: liveState.lastWrongAnswer,
  };
};

const isStaleOnlineRoom = (room: OnlineRoom, now = Date.now()) =>
  room.expiresAtMs <= now
  || room.status === 'results'
  || room.status === 'ended'
  || (room.status === 'playing' && (room.questionStartedAtMs ?? 0) <= now - STALE_PLAYING_ROOM_MS);

const serializeRoom = (roomId: string, payload: any): OnlineRoom => ({
  id: roomId,
  code: payload.code,
  hostId: payload.hostId,
  hostName: payload.hostName,
  status: payload.status,
  visibility: payload.visibility ?? 'private',
  playerCount: payload.playerCount ?? 1,
  maxPlayers: payload.maxPlayers ?? 8,
  currentQuestionIndex: payload.currentQuestionIndex,
  questionStartedAtMs: payload.questionStartedAtMs ?? null,
  questionDurationMs: payload.questionDurationMs,
  locked: payload.locked,
  winnerPlayerId: payload.winnerPlayerId ?? null,
  createdAtMs: payload.createdAtMs,
  expiresAtMs: payload.expiresAtMs,
  settings: payload.settings,
  currentQuestion: payload.currentQuestion ?? null,
  answeredPlayerIds: payload.answeredPlayerIds ?? [],
  revealedAnswer: payload.revealedAnswer ?? false,
  lastWrongAnswer: payload.lastWrongAnswer ?? null,
  regionLabel: payload.regionLabel ?? null,
  location: payload.location ?? null,
});

const withDistance = (room: OnlineRoom, viewerLocation?: Coordinates | null): OnlineRoom => {
  if (!viewerLocation || !room.location) {
    return { ...room, distanceKm: null };
  }

  return {
    ...room,
    distanceKm: getDistanceKm(viewerLocation, room.location),
  };
};

const serializePlayer = (playerId: string, payload: any): OnlinePlayer => ({
  id: playerId,
  name: payload.name,
  score: payload.score,
  connected: payload.connected,
  joinedAtMs: payload.joinedAtMs,
});

const serializePresencePlayer = (playerId: string, payload: any): OnlinePresencePlayer => ({
  id: playerId,
  name: payload.name,
  avatarEmoji: payload.avatarEmoji ?? '🎮',
  avatarUri: payload.avatarUri ?? null,
  color: payload.color ?? '#7C5CFF',
  lastSeenAtMs: payload.lastSeenAtMs ?? 0,
  activeUntilMs: payload.activeUntilMs ?? 0,
});

export const updateOnlinePresence = async (profile: UserProfile, fallbackName?: string) => {
  const displayName = (profile.name || fallbackName || 'لاعب').trim();
  const user = await ensureAuthenticatedUser({ allowGuest: true, displayName });
  const now = Date.now();
  const db = getFirebaseDb();

  await setDoc(doc(db, ONLINE_PRESENCE_COLLECTION, user.uid), {
    name: displayName,
    avatarEmoji: profile.avatarEmoji || '🎮',
    avatarUri: profile.avatarUri?.startsWith('http') ? profile.avatarUri : null,
    color: profile.color || '#7C5CFF',
    lastSeenAtMs: now,
    activeUntilMs: now + ONLINE_PRESENCE_TTL_MS,
  }, { merge: true });
};

export const subscribeToOnlinePresence = (
  onPresenceChange: (players: OnlinePresencePlayer[]) => void,
  onError?: (error: Error) => void,
) => {
  const db = getFirebaseDb();
  const presenceQuery = query(collection(db, ONLINE_PRESENCE_COLLECTION), orderBy('activeUntilMs', 'desc'), limit(24));

  return onSnapshot(
    presenceQuery,
    snapshot => {
      const now = Date.now();
      const players = snapshot.docs
        .map(playerDoc => serializePresencePlayer(playerDoc.id, playerDoc.data()))
        .filter(player => player.activeUntilMs > now);

      onPresenceChange(players);
    },
    error => {
      onError?.(error as Error);
    },
  );
};

export const ensureOnlineAuth = async (displayName?: string) => {
  const user = await ensureAuthenticatedUser({ allowGuest: true, displayName });
  return user.uid;
};

const getDefaultRoomSettings = (): OnlineRoomSettings => ({
  ageGroup: 'family',
  categories: [],
  difficulty: 'progressive',
  questionCount: 10,
  timePerQuestion: 15,
  questionLanguage: 'ar',
});

const toOnlineQuestion = (question: Question, settings: OnlineRoomSettings, questionIndex: number): OnlineQuestion => {
  const prompt = settings.questionLanguage === 'en'
    ? (question.questionEn || question.questionAr)
    : settings.questionLanguage === 'both'
      ? [question.questionAr, question.questionEn].filter(Boolean).join('\n\n')
      : settings.questionLanguage === 'mixed'
        ? (questionIndex % 2 === 0 ? (question.questionAr || question.questionEn) : (question.questionEn || question.questionAr))
        : (question.questionAr || question.questionEn);

  const answers = settings.questionLanguage === 'en'
    ? (question.answersEn.length ? question.answersEn : question.answersAr)
    : (question.answersAr.length ? question.answersAr : question.answersEn);

  const explanation = settings.questionLanguage === 'en'
    ? question.explanationEn || question.explanationAr
    : question.explanationAr || question.explanationEn;

  const onlineQuestion: OnlineQuestion = {
    id: question.id,
    prompt,
    answers,
    correctAnswerIndex: question.correctAnswerIndex ?? 0,
    points: question.points,
  };

  if (explanation) {
    onlineQuestion.explanation = explanation;
  }

  return onlineQuestion;
};

export const createRoom = async (playerName: string, visibility: OnlineRoomVisibility = 'private', customRoomCode = '') => {
  const trimmedName = playerName.trim();
  if (!trimmedName) {
    throw new Error('Player name is required');
  }

  const requestedRoomCode = normalizeRoomCode(customRoomCode);
  if (requestedRoomCode && !isValidRoomCode(requestedRoomCode)) {
    throw new Error('Room code must be 4 to 10 letters or numbers');
  }

  const location = visibility === 'nearby' ? await getCurrentCoordinates() : null;

  const playerId = await ensureOnlineAuth(trimmedName);
  const db = getFirebaseDb();
  const now = Date.now();
  const roomCode = requestedRoomCode || generateRoomCode();

  await cleanupEndedOnlineRooms().catch(() => {});

  const existingRooms = await getDocs(query(collection(db, ROOMS_COLLECTION), where('code', '==', roomCode), limit(1)));
  const existingRoomDoc = existingRooms.docs[0];
  if (existingRoomDoc) {
    const existingRoom = serializeRoom(existingRoomDoc.id, existingRoomDoc.data());
    if (isStaleOnlineRoom(existingRoom)) {
      await cleanupEndedOnlineRooms().catch(() => {});
    } else {
      throw new Error('Room code is already used');
    }
  }

  const duplicateRooms = await getDocs(query(collection(db, ROOMS_COLLECTION), where('code', '==', roomCode), limit(1)));
  if (!duplicateRooms.empty) {
    throw new Error('Room code is already used');
  }

  const roomPayload = {
    code: roomCode,
    hostId: playerId,
    hostName: trimmedName,
    status: 'lobby',
    visibility,
    playerCount: 1,
    maxPlayers: 8,
    currentQuestionIndex: 0,
    questionStartedAtMs: null,
    questionDurationMs: 15000,
    locked: false,
    winnerPlayerId: null,
    createdAtMs: now,
    expiresAtMs: now + ROOM_TTL_MS,
    settings: getDefaultRoomSettings(),
    currentQuestion: null,
    answeredPlayerIds: [],
    revealedAnswer: false,
    lastWrongAnswer: null,
    regionLabel: null,
    location,
  };

  const roomRef = await addDoc(collection(db, ROOMS_COLLECTION), roomPayload);
  await setDoc(doc(db, ROOMS_COLLECTION, roomRef.id, PLAYERS_SUBCOLLECTION, playerId), {
    name: trimmedName,
    score: 0,
    connected: true,
    joinedAtMs: now,
  });

  return {
    roomId: roomRef.id,
    playerId,
    roomCode: roomPayload.code,
  };
};

export const joinRoomByCode = async (roomCode: string, playerName: string) => {
  const code = normalizeRoomCode(roomCode);
  const trimmedName = playerName.trim();

  if (!code) {
    throw new Error('Room code is required');
  }

  if (!trimmedName) {
    throw new Error('Player name is required');
  }

  const playerId = await ensureOnlineAuth(trimmedName);
  const db = getFirebaseDb();
  const roomsQuery = query(collection(db, ROOMS_COLLECTION), where('code', '==', code), limit(1));

  const result = await getDocs(roomsQuery);
  const roomDoc = result.docs[0];
  if (!roomDoc) {
    throw new Error('Room not found');
  }

  const room = serializeRoom(roomDoc.id, roomDoc.data());
  if (isStaleOnlineRoom(room)) {
    await cleanupEndedOnlineRooms().catch(() => {});
    throw new Error('Room expired');
  }

  if (room.status !== 'lobby') {
    throw new Error('Room is not open');
  }

  if (room.playerCount >= room.maxPlayers) {
    throw new Error('Room is full');
  }

  await runFirestoreTransaction(db, async transaction => {
    const roomRef = doc(db, ROOMS_COLLECTION, room.id);
    const playerRef = doc(db, ROOMS_COLLECTION, room.id, PLAYERS_SUBCOLLECTION, playerId);
    const freshRoomSnapshot = await transaction.get(roomRef);
    const existingPlayerSnapshot = await transaction.get(playerRef);
    if (!freshRoomSnapshot.exists()) {
      throw new Error('Room not found');
    }

    const freshRoom = serializeRoom(freshRoomSnapshot.id, freshRoomSnapshot.data());
    if (!existingPlayerSnapshot.exists() && freshRoom.playerCount >= freshRoom.maxPlayers) {
      throw new Error('Room is full');
    }

    transaction.set(playerRef, {
      name: trimmedName,
      score: 0,
      connected: true,
      joinedAtMs: Date.now(),
    }, { merge: true });

    if (!existingPlayerSnapshot.exists()) {
      transaction.update(roomRef, {
        playerCount: freshRoom.playerCount + 1,
      });
    }
  });

  return {
    roomId: room.id,
    playerId,
    roomCode: room.code,
  };
};

export const joinRoomById = async (roomId: string, playerName: string) => {
  const trimmedName = playerName.trim();
  if (!trimmedName) {
    throw new Error('Player name is required');
  }

  const playerId = await ensureOnlineAuth(trimmedName);
  const db = getFirebaseDb();
  const roomRef = doc(db, ROOMS_COLLECTION, roomId);

  await runFirestoreTransaction(db, async transaction => {
    const roomSnapshot = await transaction.get(roomRef);
    if (!roomSnapshot.exists()) {
      throw new Error('Room not found');
    }

    const room = serializeRoom(roomSnapshot.id, roomSnapshot.data());
    if (room.status !== 'lobby') {
      throw new Error('Room is not open');
    }
    if (room.expiresAtMs <= Date.now()) {
      throw new Error('Room expired');
    }
    if (room.visibility !== 'public' && room.visibility !== 'nearby') {
      throw new Error('Room is not discoverable');
    }
    if (room.playerCount >= room.maxPlayers) {
      throw new Error('Room is full');
    }

    transaction.set(doc(db, ROOMS_COLLECTION, roomId, PLAYERS_SUBCOLLECTION, playerId), {
      name: trimmedName,
      score: 0,
      connected: true,
      joinedAtMs: Date.now(),
    }, { merge: true });

    transaction.update(roomRef, {
      playerCount: room.playerCount + 1,
    });
  });

  const roomSnapshot = await getDoc(roomRef);
  const room = serializeRoom(roomSnapshot.id, roomSnapshot.data());

  return {
    roomId,
    playerId,
    roomCode: room.code,
  };
};

export const subscribeToRoom = (
  roomId: string,
  onRoomChange: (room: OnlineRoom | null) => void,
  onPlayersChange: (players: OnlinePlayer[]) => void,
) => {
  const db = getFirebaseDb();
  const roomRef = doc(db, ROOMS_COLLECTION, roomId);
  const playersRef = query(collection(db, ROOMS_COLLECTION, roomId, PLAYERS_SUBCOLLECTION), orderBy('joinedAtMs', 'asc'));
  const liveRoomRef = getLiveRoomStateRef(roomId);
  let latestRoom: OnlineRoom | null = null;
  let latestLiveState: OnlineLiveRoomState | null = null;

  const emitRoom = () => {
    onRoomChange(latestRoom ? mergeLiveRoomState(latestRoom, latestLiveState) : null);
  };

  const unsubscribeRoom = onSnapshot(roomRef, snapshot => {
    if (!snapshot.exists()) {
      latestRoom = null;
      emitRoom();
      return;
    }

    latestRoom = serializeRoom(snapshot.id, snapshot.data());
    emitRoom();
  });

  const unsubscribeLiveRoom = onValue(liveRoomRef, snapshot => {
    latestLiveState = snapshot.val() ?? null;
    emitRoom();
  });

  const unsubscribePlayers = onSnapshot(playersRef, snapshot => {
    onPlayersChange(snapshot.docs.map(playerDoc => serializePlayer(playerDoc.id, playerDoc.data())));
  });

  return () => {
    unsubscribeRoom();
    unsubscribeLiveRoom();
    unsubscribePlayers();
  };
};

export const subscribeToPublicRooms = (
  onRoomsChange: (rooms: OnlineRoom[]) => void,
  onError?: (error: Error) => void,
  viewerLocation?: Coordinates | null,
) => {
  const db = getFirebaseDb();
  const roomsRef = collection(db, ROOMS_COLLECTION);

  return onSnapshot(
    roomsRef,
    snapshot => {
      const rooms = snapshot.docs
        .map(roomDoc => serializeRoom(roomDoc.id, roomDoc.data()))
        .filter(room => (room.visibility === 'public' || room.visibility === 'nearby') && room.status === 'lobby' && room.expiresAtMs > Date.now())
        .map(room => withDistance(room, viewerLocation))
        .filter(room => room.visibility === 'public' || (typeof room.distanceKm === 'number' && room.distanceKm <= NEARBY_ROOM_RADIUS_KM))
        .sort((left, right) => {
          if (left.visibility === 'nearby' && right.visibility === 'nearby') {
            return (left.distanceKm ?? Number.MAX_SAFE_INTEGER) - (right.distanceKm ?? Number.MAX_SAFE_INTEGER);
          }

          return right.createdAtMs - left.createdAtMs;
        });

      onRoomsChange(rooms);
    },
    error => {
      onError?.(error as Error);
    },
  );
};

export const cleanupEndedOnlineRooms = async () => {
  const cleanupEndedRooms = httpsCallable(getFirebaseFunctions(), 'cleanupEndedRooms');
  await cleanupEndedRooms();
};

export const startRoom = async (roomId: string) => {
  const db = getFirebaseDb();
  const roomRef = doc(db, ROOMS_COLLECTION, roomId);
  const snapshot = await getDoc(roomRef);

  if (!snapshot.exists()) {
    throw new Error('Room not found');
  }

  const room = serializeRoom(snapshot.id, snapshot.data());
  const playersSnapshot = await getDocs(query(collection(db, ROOMS_COLLECTION, roomId, PLAYERS_SUBCOLLECTION), orderBy('joinedAtMs', 'asc')));
  const playerCount = Math.max(1, playersSnapshot.size || room.playerCount || 1);
  const questionBank = await loadQuestionBank();
  const availableQuestionCount = getAvailableQuestionCountFromBank(questionBank, {
    categories: room.settings.categories,
    ageGroup: room.settings.ageGroup,
    difficulty: room.settings.difficulty,
    questionLanguage: room.settings.questionLanguage,
  });

  if (availableQuestionCount < 1) {
    throw new Error('No questions available for this room');
  }

  const fairQuestionCount = getRecommendedFairQuestionCount({
    availableQuestionCount,
    playerCount,
  });

  const selectedQuestions = await getQuestions({
    mode: 'group',
    ageGroup: room.settings.ageGroup,
    categories: room.settings.categories,
    difficulty: room.settings.difficulty,
    questionCount: fairQuestionCount,
    timePerQuestion: room.settings.timePerQuestion,
    questionLanguage: room.settings.questionLanguage,
    randomOrder: false,
    allowRepeat: true,
    soundEnabled: true,
    readQuestion: false,
    lifelines: { enabled: false, fiftyFifty: 0, extraTime: 0, changeQuestion: 0, hint: 0 },
  });

  if (!selectedQuestions.length) {
    throw new Error('No questions available for this room');
  }

  const onlineQuestions = selectedQuestions.map((question, index) => toOnlineQuestion(question, room.settings, index));

  await updateDoc(roomRef, {
    status: 'playing',
    questionStartedAtMs: Date.now(),
    locked: false,
    currentQuestionIndex: 0,
    currentQuestion: onlineQuestions[0],
    questions: onlineQuestions,
    answeredPlayerIds: [],
    revealedAnswer: false,
    winnerPlayerId: null,
    lastWrongAnswer: null,
    questionDurationMs: room.settings.timePerQuestion * 1000,
    playerCount,
    fairQuestionCount,
  });

  await set(getLiveRoomStateRef(roomId), createOpenLiveRoomState(0));
};

export const submitRoomAnswer = async (
  roomId: string,
  playerId: string,
  selectedAnswerIndex: number,
) => {
  const db = getFirebaseDb();
  const roomRef = doc(db, ROOMS_COLLECTION, roomId);
  const playerRef = doc(db, ROOMS_COLLECTION, roomId, PLAYERS_SUBCOLLECTION, playerId);
  const liveRoomRef = getLiveRoomStateRef(roomId);

  const roomSnapshot = await getDoc(roomRef);
  const playerSnapshot = await getDoc(playerRef);

  if (!roomSnapshot.exists() || !playerSnapshot.exists()) {
    throw new Error('Room or player not found');
  }

  const room = serializeRoom(roomSnapshot.id, roomSnapshot.data());
  const player = serializePlayer(playerSnapshot.id, playerSnapshot.data());

  if (room.status !== 'playing' || !room.currentQuestion) {
    throw new Error('Round is not active');
  }

  if (room.locked || room.revealedAnswer) {
    return { accepted: false, locked: true, correct: false };
  }

  if (room.answeredPlayerIds.includes(playerId)) {
    return { accepted: false, locked: false, correct: false };
  }

  const answerAtMs = Date.now();
  const isCorrect = room.currentQuestion.correctAnswerIndex === selectedAnswerIndex;
  const answerText = room.currentQuestion.answers[selectedAnswerIndex] ?? '';

  if (isCorrect) {
    const winnerResult = await runRealtimeTransaction(liveRoomRef, current => {
      const liveState = current ?? createOpenLiveRoomState(room.currentQuestionIndex);
      if (liveState.currentQuestionIndex !== room.currentQuestionIndex || liveState.locked || liveState.revealedAnswer) {
        return liveState;
      }

      return {
        ...liveState,
        locked: true,
        winnerPlayerId: playerId,
        revealedAnswer: true,
        lastWrongAnswer: null,
        updatedAtMs: answerAtMs,
      };
    });

    const liveState = winnerResult.snapshot.val() as OnlineLiveRoomState | null;
    if (!winnerResult.committed || liveState?.winnerPlayerId !== playerId) {
      return { accepted: false, locked: true, correct: false };
    }

    await runFirestoreTransaction(db, async transaction => {
      const freshRoomSnapshot = await transaction.get(roomRef);
      const freshPlayerSnapshot = await transaction.get(playerRef);
      if (!freshRoomSnapshot.exists() || !freshPlayerSnapshot.exists()) {
        throw new Error('Room or player not found');
      }

      const freshRoom = serializeRoom(freshRoomSnapshot.id, freshRoomSnapshot.data());
      const freshPlayer = serializePlayer(freshPlayerSnapshot.id, freshPlayerSnapshot.data());
      const answeredPlayerIds = freshRoom.answeredPlayerIds.includes(playerId)
        ? freshRoom.answeredPlayerIds
        : [...freshRoom.answeredPlayerIds, playerId];

      if (freshRoom.winnerPlayerId !== playerId) {
        transaction.update(playerRef, {
          score: freshPlayer.score + room.currentQuestion!.points,
        });
      }

      transaction.update(roomRef, {
        answeredPlayerIds,
        lastAnswerAtMs: answerAtMs,
        locked: true,
        revealedAnswer: true,
        winnerPlayerId: playerId,
        lastWrongAnswer: null,
      });
    });

    return { accepted: true, locked: true, correct: true };
  }

  const wrongAnswer = {
    id: `${playerId}-${answerAtMs}`,
    playerId,
    playerName: player.name,
    answerText,
    questionIndex: room.currentQuestionIndex,
    createdAtMs: answerAtMs,
  };

  const wrongResult = await runRealtimeTransaction(liveRoomRef, current => {
    const liveState = current ?? createOpenLiveRoomState(room.currentQuestionIndex);
    if (liveState.currentQuestionIndex !== room.currentQuestionIndex || liveState.locked || liveState.revealedAnswer) {
      return liveState;
    }

    return {
      ...liveState,
      lastWrongAnswer: wrongAnswer,
      updatedAtMs: answerAtMs,
    };
  });

  const liveState = wrongResult.snapshot.val() as OnlineLiveRoomState | null;
  if (!wrongResult.committed || liveState?.lastWrongAnswer?.id !== wrongAnswer.id) {
    return { accepted: false, locked: true, correct: false };
  }

  await runFirestoreTransaction(db, async transaction => {
    const freshRoomSnapshot = await transaction.get(roomRef);
    if (!freshRoomSnapshot.exists()) {
      throw new Error('Room not found');
    }

    const freshRoom = serializeRoom(freshRoomSnapshot.id, freshRoomSnapshot.data());
    if (freshRoom.answeredPlayerIds.includes(playerId)) {
      return;
    }

    transaction.update(roomRef, {
      answeredPlayerIds: [...freshRoom.answeredPlayerIds, playerId],
      lastAnswerAtMs: answerAtMs,
      lastWrongAnswer: wrongAnswer,
    });
  });

  return { accepted: true, locked: false, correct: false };
};

export const revealRoomAnswer = async (roomId: string) => {
  const db = getFirebaseDb();
  const roomRef = doc(db, ROOMS_COLLECTION, roomId);
  const snapshot = await getDoc(roomRef);
  const currentQuestionIndex = snapshot.exists() ? serializeRoom(snapshot.id, snapshot.data()).currentQuestionIndex : 0;

  await runRealtimeTransaction(getLiveRoomStateRef(roomId), current => ({
    ...(current ?? createOpenLiveRoomState(currentQuestionIndex)),
    currentQuestionIndex,
    locked: true,
    revealedAnswer: true,
    updatedAtMs: Date.now(),
  }));

  await updateDoc(roomRef, {
    locked: true,
    revealedAnswer: true,
  });
};

export const advanceRoomQuestion = async (roomId: string) => {
  const db = getFirebaseDb();
  const roomRef = doc(db, ROOMS_COLLECTION, roomId);
  let advancedQuestionIndex: number | null = null;

  const result = await runFirestoreTransaction(db, async transaction => {
    const roomSnapshot = await transaction.get(roomRef);
    if (!roomSnapshot.exists()) {
      throw new Error('Room not found');
    }

    const roomData = roomSnapshot.data();
    const room = serializeRoom(roomSnapshot.id, roomData);
    const questions = Array.isArray(roomData.questions) ? roomData.questions as OnlineQuestion[] : [];
    const nextQuestionIndex = room.currentQuestionIndex + 1;

    if (nextQuestionIndex >= questions.length) {
      transaction.update(roomRef, {
        status: 'results',
        currentQuestion: null,
        revealedAnswer: true,
        locked: true,
      });
      return { finished: true };
    }

    transaction.update(roomRef, {
      currentQuestionIndex: nextQuestionIndex,
      currentQuestion: questions[nextQuestionIndex],
      questionStartedAtMs: Date.now(),
      answeredPlayerIds: [],
      revealedAnswer: false,
      locked: false,
      winnerPlayerId: null,
      lastWrongAnswer: null,
    });
    advancedQuestionIndex = nextQuestionIndex;

    return { finished: false };
  });

  if (advancedQuestionIndex !== null) {
    await set(getLiveRoomStateRef(roomId), createOpenLiveRoomState(advancedQuestionIndex));
  }

  return result;
};

export const deleteRoom = async (roomId: string) => {
  const db = getFirebaseDb();
  const roomRef = doc(db, ROOMS_COLLECTION, roomId);
  const playersSnapshot = await getDocs(collection(db, ROOMS_COLLECTION, roomId, PLAYERS_SUBCOLLECTION));
  const batch = writeBatch(db);

  playersSnapshot.forEach(playerDoc => {
    batch.delete(playerDoc.ref);
  });

  batch.delete(roomRef);
  await batch.commit();
  await set(getLiveRoomStateRef(roomId), null);
};

export const leaveRoom = async (roomId: string, playerId: string) => {
  const db = getFirebaseDb();
  const roomRef = doc(db, ROOMS_COLLECTION, roomId);
  const roomSnapshot = await getDoc(roomRef);

  if (!roomSnapshot.exists()) {
    return;
  }

  const room = serializeRoom(roomSnapshot.id, roomSnapshot.data());
  if (room.hostId === playerId) {
    await deleteRoom(roomId);
    return;
  }

  const playerRef = doc(db, ROOMS_COLLECTION, roomId, PLAYERS_SUBCOLLECTION, playerId);

  await runFirestoreTransaction(db, async transaction => {
    const latestRoomSnapshot = await transaction.get(roomRef);
    if (!latestRoomSnapshot.exists()) {
      return;
    }

    const latestRoom = serializeRoom(latestRoomSnapshot.id, latestRoomSnapshot.data());
    transaction.delete(playerRef);

    transaction.update(roomRef, {
      playerCount: Math.max(0, latestRoom.playerCount - 1),
    });
  });
};