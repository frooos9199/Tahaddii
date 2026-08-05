const admin = require('firebase-admin');
const functions = require('firebase-functions/v1');

admin.initializeApp({
  databaseURL: process.env.FIREBASE_DATABASE_URL || 'https://tahaddi-77a5d-default-rtdb.asia-southeast1.firebasedatabase.app',
});

const db = admin.firestore();
const auth = admin.auth();
const realtimeDb = admin.database();
const REGION = 'us-central1';
const ROOM_DELETE_BATCH_SIZE = 50;
const STALE_PLAYING_ROOM_MS = 30 * 60 * 1000;

const assertSuperAdmin = async context => {
  const uid = context.auth?.uid;
  if (!uid) {
    throw new functions.https.HttpsError('unauthenticated', 'Authentication required.');
  }
  // Fast path: JWT custom claims (present after token refresh / re-login)
  if (context.auth.token?.isSuperAdmin === true || context.auth.token?.role === 'super_admin') {
    return;
  }
  // Fallback: Firestore document — safe because Firestore rules block self-promotion
  const userDoc = await db.collection('users').doc(uid).get();
  if (userDoc.exists && userDoc.data()?.isSuperAdmin === true) {
    return;
  }
  throw new functions.https.HttpsError('permission-denied', 'Only super admins can perform this action.');
};

const buildClaims = role => ({
  role,
  roles: [role],
  isAdmin: role === 'admin' || role === 'super_admin',
  isSuperAdmin: role === 'super_admin',
});

const normalizeRole = role => {
  if (role === 'user' || role === 'admin' || role === 'super_admin') {
    return role;
  }

  throw new functions.https.HttpsError('invalid-argument', 'Invalid role value.');
};

const getUserByIdentity = async ({ email, uid }) => {
  if (email) {
    return auth.getUserByEmail(email.trim());
  }

  if (uid) {
    return auth.getUser(uid);
  }

  throw new functions.https.HttpsError('invalid-argument', 'email or uid is required.');
};

const deleteRoomDeep = async roomId => {
  const roomRef = db.collection('rooms').doc(roomId);
  const playersSnapshot = await roomRef.collection('players').get();
  const batch = db.batch();

  playersSnapshot.forEach(playerDoc => batch.delete(playerDoc.ref));
  batch.delete(roomRef);
  await batch.commit();
  await realtimeDb.ref(`onlineRoomStates/${roomId}`).remove().catch(() => {});
};

const cleanupEndedRooms = async () => {
  const now = Date.now();
  const stalePlayingBeforeMs = now - STALE_PLAYING_ROOM_MS;
  const [expiredRooms, resultRooms, endedRooms, playingRooms] = await Promise.all([
    db.collection('rooms').where('expiresAtMs', '<=', now).limit(ROOM_DELETE_BATCH_SIZE).get(),
    db.collection('rooms').where('status', '==', 'results').limit(ROOM_DELETE_BATCH_SIZE).get(),
    db.collection('rooms').where('status', '==', 'ended').limit(ROOM_DELETE_BATCH_SIZE).get(),
    db.collection('rooms').where('status', '==', 'playing').limit(ROOM_DELETE_BATCH_SIZE).get(),
  ]);

  const roomsById = new Map();
  for (const snapshot of [expiredRooms, resultRooms, endedRooms]) {
    snapshot.docs.forEach(roomDoc => roomsById.set(roomDoc.id, roomDoc));
  }
  playingRooms.docs
    .filter(roomDoc => (roomDoc.data().questionStartedAtMs ?? 0) <= stalePlayingBeforeMs)
    .forEach(roomDoc => roomsById.set(roomDoc.id, roomDoc));

  for (const roomId of roomsById.keys()) {
    await deleteRoomDeep(roomId);
  }

  return { deleted: roomsById.size };
};

const pruneRoomRefs = async uid => {
  const hostedRooms = await db.collection('rooms').where('hostId', '==', uid).get();
  for (const roomDoc of hostedRooms.docs) {
    await deleteRoomDeep(roomDoc.id);
  }

  const roomsSnapshot = await db.collection('rooms').get();
  for (const roomDoc of roomsSnapshot.docs) {
    const playerRef = roomDoc.ref.collection('players').doc(uid);
    const playerSnapshot = await playerRef.get();
    if (!playerSnapshot.exists) {
      continue;
    }

    await playerRef.delete();
    const roomData = roomDoc.data();
    const answeredPlayerIds = Array.isArray(roomData.answeredPlayerIds)
      ? roomData.answeredPlayerIds.filter(playerId => playerId !== uid)
      : [];

    await roomDoc.ref.set({
      playerCount: Math.max(0, (roomData.playerCount ?? 1) - 1),
      answeredPlayerIds,
      winnerPlayerId: roomData.winnerPlayerId === uid ? null : (roomData.winnerPlayerId ?? null),
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    }, { merge: true });
  }
};

exports.setUserRole = functions.region(REGION).https.onCall(async (data, context) => {
  const request = { data, auth: context.auth };
  await assertSuperAdmin(context);

  const role = normalizeRole(request.data?.role);
  const targetUser = await getUserByIdentity({
    email: request.data?.email,
    uid: request.data?.uid,
  });

  if (targetUser.uid === request.auth.uid) {
    throw new functions.https.HttpsError('failed-precondition', 'You cannot change your own role.');
  }

  await auth.setCustomUserClaims(targetUser.uid, buildClaims(role));

  await db.collection('users').doc(targetUser.uid).set({
    uid: targetUser.uid,
    email: targetUser.email ?? null,
    displayName: targetUser.displayName ?? (targetUser.email ? targetUser.email.split('@')[0] : 'User'),
    role,
    roles: [role],
    isAdmin: role === 'admin' || role === 'super_admin',
    isSuperAdmin: role === 'super_admin',
    isGuest: false,
    authProvider: 'password',
    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
  }, { merge: true });

  return {
    uid: targetUser.uid,
    email: targetUser.email ?? null,
    role,
  };
});

exports.deleteUserFully = functions.region(REGION).https.onCall(async (data, context) => {
  const request = { data, auth: context.auth };
  await assertSuperAdmin(context);

  const targetUser = await getUserByIdentity({
    email: request.data?.email,
    uid: request.data?.uid,
  });

  if (targetUser.uid === request.auth.uid) {
    throw new functions.https.HttpsError('failed-precondition', 'You cannot delete your own account.');
  }

  await pruneRoomRefs(targetUser.uid);
  await db.collection('users').doc(targetUser.uid).delete().catch(() => {});
  await auth.deleteUser(targetUser.uid);

  return {
    uid: targetUser.uid,
    email: targetUser.email ?? null,
    deleted: true,
  };
});

exports.cleanupEndedRooms = functions.region(REGION).https.onCall(async (_data, context) => {
  if (!context.auth?.uid) {
    throw new functions.https.HttpsError('unauthenticated', 'Authentication required.');
  }

  return cleanupEndedRooms();
});

exports.scheduledCleanupEndedRooms = functions.region(REGION).pubsub.schedule('every 30 minutes').onRun(() => cleanupEndedRooms());