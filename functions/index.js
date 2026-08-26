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

const assertAdmin = async context => {
  const uid = context.auth?.uid;
  if (!uid) {
    throw new functions.https.HttpsError('unauthenticated', 'Authentication required.');
  }
  if (
    context.auth.token?.isAdmin === true
    || context.auth.token?.isSuperAdmin === true
    || context.auth.token?.role === 'admin'
    || context.auth.token?.role === 'super_admin'
  ) {
    return;
  }
  const userDoc = await db.collection('users').doc(uid).get();
  const userData = userDoc.exists ? userDoc.data() : null;
  if (userData?.isAdmin === true || userData?.isSuperAdmin === true) {
    return;
  }
  throw new functions.https.HttpsError('permission-denied', 'Only admins can perform this action.');
};

const isAnonymousContext = context => context.auth?.token?.firebase?.sign_in_provider === 'anonymous';

// Merges a new entitlement grant into a user's denormalized access summary.
// 'extend' unions the category sets and keeps the later expiry; 'replace' overwrites both.
const mergeEntitlementIntoUserSummary = ({ existingCategoryIds, existingExpiresAtMs, newCategoryIds, newExpiresAtMs, mode }) => {
  if (mode === 'replace') {
    return { unlockedCategoryIds: [...new Set(newCategoryIds)], entitlementExpiresAtMs: newExpiresAtMs };
  }
  const merged = new Set([...(existingCategoryIds || []), ...newCategoryIds]);
  const entitlementExpiresAtMs = Math.max(existingExpiresAtMs || 0, newExpiresAtMs);
  return { unlockedCategoryIds: [...merged], entitlementExpiresAtMs };
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

exports.assignCustomerNumberDirectly = functions.region(REGION).https.onCall(async (_data, context) => {
  const uid = context.auth?.uid;
  if (!uid) {
    throw new functions.https.HttpsError('unauthenticated', 'Authentication required.');
  }
  if (isAnonymousContext(context)) {
    return { skipped: true };
  }

  const userRef = db.collection('users').doc(uid);
  const counterRef = db.collection('counters').doc('customers');

  return db.runTransaction(async tx => {
    const userSnap = await tx.get(userRef);
    const existing = userSnap.exists ? userSnap.data()?.customerNumber : null;
    if (existing) {
      return { customerNumber: existing, alreadyAssigned: true };
    }

    const counterSnap = await tx.get(counterRef);
    const next = counterSnap.exists ? (counterSnap.data().nextValue || 3000) : 3000;
    tx.set(counterRef, { nextValue: next + 1 }, { merge: true });
    tx.set(userRef, { customerNumber: next }, { merge: true });
    return { customerNumber: next, alreadyAssigned: false };
  });
});

exports.grantEntitlement = functions.region(REGION).https.onCall(async (data, context) => {
  await assertAdmin(context);

  const uids = Array.isArray(data?.uids) ? data.uids.filter(Boolean) : [];
  const categoryIds = Array.isArray(data?.categoryIds) ? data.categoryIds.filter(Boolean) : [];
  const expiresAtMs = Number(data?.expiresAtMs);
  const mode = data?.mode === 'replace' ? 'replace' : 'extend';
  const note = typeof data?.note === 'string' ? data.note.trim().slice(0, 500) : null;
  const packageId = data?.packageId || null;

  if (!uids.length) {
    throw new functions.https.HttpsError('invalid-argument', 'uids is required.');
  }
  if (!categoryIds.length) {
    throw new functions.https.HttpsError('invalid-argument', 'categoryIds is required.');
  }
  if (!Number.isFinite(expiresAtMs) || expiresAtMs <= Date.now()) {
    throw new functions.https.HttpsError('invalid-argument', 'expiresAtMs must be a future timestamp.');
  }

  const grantedAtMs = Date.now();
  const results = [];

  for (const uid of uids) {
    const userRef = db.collection('users').doc(uid);
    const userSnap = await userRef.get();
    if (!userSnap.exists) {
      results.push({ uid, ok: false, error: 'user-not-found' });
      continue;
    }

    const userData = userSnap.data();
    const summary = mergeEntitlementIntoUserSummary({
      existingCategoryIds: userData.unlockedCategoryIds,
      existingExpiresAtMs: userData.entitlementExpiresAtMs,
      newCategoryIds: categoryIds,
      newExpiresAtMs: expiresAtMs,
      mode,
    });

    const entitlementRef = userRef.collection('entitlements').doc();
    const batch = db.batch();
    batch.set(entitlementRef, {
      id: entitlementRef.id,
      categoryIds,
      grantedAtMs,
      expiresAtMs,
      origin: {
        type: packageId ? 'package' : 'adminManual',
        packageId,
        promoCode: null,
        grantedByAdminUid: context.auth.uid,
        note,
      },
      status: 'active',
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
    });
    batch.set(userRef, {
      unlockedCategoryIds: summary.unlockedCategoryIds,
      entitlementExpiresAtMs: summary.entitlementExpiresAtMs,
      entitlementSource: packageId ? `package:${packageId}` : 'adminManual',
    }, { merge: true });
    await batch.commit();

    results.push({
      uid,
      ok: true,
      unlockedCategoryIds: summary.unlockedCategoryIds,
      entitlementExpiresAtMs: summary.entitlementExpiresAtMs,
    });
  }

  return { results };
});

exports.createPromoCode = functions.region(REGION).https.onCall(async (data, context) => {
  await assertAdmin(context);

  const code = String(data?.code || '').trim().toUpperCase();
  if (!/^[A-Z0-9]{4,20}$/.test(code)) {
    throw new functions.https.HttpsError('invalid-argument', 'Code must be 4-20 letters/numbers.');
  }

  const type = data?.type;
  if (!['free', 'discountPercent', 'discountFixedKwd'].includes(type)) {
    throw new functions.https.HttpsError('invalid-argument', 'Invalid promo code type.');
  }
  if (type === 'free' && !data?.packageId) {
    throw new functions.https.HttpsError('invalid-argument', 'Free codes require a packageId.');
  }

  const codeRef = db.collection('promoCodes').doc(code);
  const existing = await codeRef.get();
  if (existing.exists) {
    throw new functions.https.HttpsError('already-exists', 'This code already exists.');
  }

  await codeRef.set({
    code,
    type,
    discountValue: data?.discountValue != null ? Number(data.discountValue) : null,
    packageId: data?.packageId || null,
    maxRedemptions: Number(data?.maxRedemptions) > 0 ? Number(data.maxRedemptions) : 1,
    redemptionCount: 0,
    expiresAtMs: data?.expiresAtMs != null ? Number(data.expiresAtMs) : null,
    isActive: true,
    createdByAdminUid: context.auth.uid,
    createdAtMs: Date.now(),
  });

  return { code };
});

exports.deactivatePromoCode = functions.region(REGION).https.onCall(async (data, context) => {
  await assertAdmin(context);

  const code = String(data?.code || '').trim().toUpperCase();
  if (!code) {
    throw new functions.https.HttpsError('invalid-argument', 'code is required.');
  }

  const codeRef = db.collection('promoCodes').doc(code);
  const snap = await codeRef.get();
  if (!snap.exists) {
    throw new functions.https.HttpsError('not-found', 'Code not found.');
  }

  if ((snap.data().redemptionCount || 0) === 0) {
    await codeRef.delete();
    return { code, deleted: true };
  }

  await codeRef.set({ isActive: false }, { merge: true });
  return { code, deactivated: true };
});

exports.redeemPromoCode = functions.region(REGION).https.onCall(async (data, context) => {
  const uid = context.auth?.uid;
  if (!uid) {
    throw new functions.https.HttpsError('unauthenticated', 'Authentication required.');
  }
  if (isAnonymousContext(context)) {
    throw new functions.https.HttpsError('permission-denied', 'Guests cannot redeem codes. Please create an account first.');
  }

  const code = String(data?.code || '').trim().toUpperCase();
  if (!code) {
    throw new functions.https.HttpsError('invalid-argument', 'code is required.');
  }

  const codeRef = db.collection('promoCodes').doc(code);
  const redemptionRef = db.collection('promoRedemptions').doc(`${uid}_${code}`);
  const userRef = db.collection('users').doc(uid);

  return db.runTransaction(async tx => {
    const [codeSnap, redemptionSnap, userSnap] = await Promise.all([
      tx.get(codeRef),
      tx.get(redemptionRef),
      tx.get(userRef),
    ]);

    if (!codeSnap.exists) {
      throw new functions.https.HttpsError('not-found', 'Invalid code.');
    }
    const codeData = codeSnap.data();
    if (!codeData.isActive) {
      throw new functions.https.HttpsError('failed-precondition', 'This code is no longer active.');
    }
    if (codeData.expiresAtMs && codeData.expiresAtMs < Date.now()) {
      throw new functions.https.HttpsError('failed-precondition', 'This code has expired.');
    }
    if ((codeData.redemptionCount || 0) >= (codeData.maxRedemptions || 1)) {
      throw new functions.https.HttpsError('failed-precondition', 'This code has been fully redeemed.');
    }
    if (redemptionSnap.exists) {
      throw new functions.https.HttpsError('already-exists', 'You already redeemed this code.');
    }

    if (codeData.type !== 'free') {
      tx.set(redemptionRef, { uid, code, redeemedAtMs: Date.now(), entitlementId: null });
      tx.set(codeRef, { redemptionCount: (codeData.redemptionCount || 0) + 1 }, { merge: true });
      return { status: 'discount', type: codeData.type, discountValue: codeData.discountValue ?? null };
    }

    if (!codeData.packageId) {
      throw new functions.https.HttpsError('failed-precondition', 'This code has no linked package.');
    }
    const packageSnap = await tx.get(db.collection('packages').doc(codeData.packageId));
    if (!packageSnap.exists) {
      throw new functions.https.HttpsError('failed-precondition', 'Linked package no longer exists.');
    }
    const pkg = packageSnap.data();

    const grantedAtMs = Date.now();
    const newExpiresAtMs = grantedAtMs + (Number(pkg.durationDays) || 0) * 86400000;
    const userData = userSnap.exists ? userSnap.data() : {};
    const summary = mergeEntitlementIntoUserSummary({
      existingCategoryIds: userData.unlockedCategoryIds,
      existingExpiresAtMs: userData.entitlementExpiresAtMs,
      newCategoryIds: pkg.categoryIds,
      newExpiresAtMs,
      mode: 'extend',
    });

    const entitlementRef = userRef.collection('entitlements').doc();
    tx.set(entitlementRef, {
      id: entitlementRef.id,
      categoryIds: pkg.categoryIds,
      grantedAtMs,
      expiresAtMs: newExpiresAtMs,
      origin: { type: 'promoFree', packageId: codeData.packageId, promoCode: code, grantedByAdminUid: null, note: null },
      status: 'active',
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
    });
    tx.set(userRef, {
      unlockedCategoryIds: summary.unlockedCategoryIds,
      entitlementExpiresAtMs: summary.entitlementExpiresAtMs,
      entitlementSource: `promo:${code}`,
    }, { merge: true });
    tx.set(redemptionRef, { uid, code, redeemedAtMs: grantedAtMs, entitlementId: entitlementRef.id });
    tx.set(codeRef, { redemptionCount: (codeData.redemptionCount || 0) + 1 }, { merge: true });

    return {
      status: 'granted',
      packageNameAr: pkg.nameAr,
      packageNameEn: pkg.nameEn,
      categoryIds: pkg.categoryIds,
      expiresAtMs: newExpiresAtMs,
    };
  });
});