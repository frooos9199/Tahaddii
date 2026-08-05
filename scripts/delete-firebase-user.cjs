const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');
const { initializeApp, cert, getApps } = require('firebase-admin/app');
const { getAuth } = require('firebase-admin/auth');
const { getFirestore, FieldValue } = require('firebase-admin/firestore');

const ROOT_DIR = path.resolve(__dirname, '..');
const FIREBASE_CLI_STATE = path.join(process.env.HOME || '', '.config', 'configstore', 'firebase-tools.json');

const parseArgs = (argv) => {
  const args = {};

  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    if (!token.startsWith('--')) {
      continue;
    }

    const key = token.slice(2);
    const value = argv[index + 1];
    if (!value || value.startsWith('--')) {
      args[key] = 'true';
      continue;
    }

    args[key] = value;
    index += 1;
  }

  return args;
};

const readDotEnv = () => {
  const envPath = path.join(ROOT_DIR, '.env');
  if (!fs.existsSync(envPath)) {
    return {};
  }

  return fs.readFileSync(envPath, 'utf8')
    .split(/\r?\n/)
    .filter(Boolean)
    .reduce((accumulator, line) => {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) {
        return accumulator;
      }

      const separatorIndex = trimmed.indexOf('=');
      if (separatorIndex < 0) {
        return accumulator;
      }

      const key = trimmed.slice(0, separatorIndex).trim();
      const value = trimmed.slice(separatorIndex + 1).trim();
      accumulator[key] = value;
      return accumulator;
    }, {});
};

const tryReadServiceAccount = () => {
  const rawJson = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
  if (rawJson) {
    return JSON.parse(rawJson);
  }

  const jsonPath = process.env.FIREBASE_SERVICE_ACCOUNT_PATH;
  if (jsonPath) {
    const absolutePath = path.resolve(jsonPath);
    return JSON.parse(fs.readFileSync(absolutePath, 'utf8'));
  }

  return null;
};

const readFirebaseCliAccessToken = () => {
  if (!fs.existsSync(FIREBASE_CLI_STATE)) {
    return null;
  }

  const state = JSON.parse(fs.readFileSync(FIREBASE_CLI_STATE, 'utf8'));
  return state.tokens?.access_token ?? null;
};

const resolveProjectConfig = (args) => {
  const env = readDotEnv();

  return {
    projectId: args.project ?? process.env.FIREBASE_PROJECT_ID ?? env.FIREBASE_PROJECT_ID,
  };
};

const extractErrorMessage = (payload, fallback) => {
  if (!payload) {
    return fallback;
  }

  if (typeof payload.error?.message === 'string') {
    return payload.error.message;
  }

  if (typeof payload.message === 'string') {
    return payload.message;
  }

  return fallback;
};

const requestJson = async (url, options = {}) => {
  const { method = 'GET', headers = {}, body } = options;
  const response = await fetch(url, {
    method,
    headers: {
      ...(body ? { 'Content-Type': 'application/json' } : {}),
      ...headers,
    },
    body: body ? JSON.stringify(body) : undefined,
  });

  const text = await response.text();
  const payload = text ? JSON.parse(text) : {};

  if (!response.ok) {
    throw new Error(extractErrorMessage(payload, `Request failed with status ${response.status}`));
  }

  return payload;
};

const ensureFreshFirebaseCliToken = () => {
  try {
    execFileSync('firebase', ['projects:list', '--json'], { stdio: 'ignore' });
  } catch {
    // Ignore here; the next authenticated request will surface the real error.
  }

  return readFirebaseCliAccessToken();
};

const getAdminApp = () => {
  if (getApps().length > 0) {
    return getApps()[0];
  }

  const serviceAccount = tryReadServiceAccount();
  if (!serviceAccount) {
    return null;
  }

  return initializeApp({
    credential: cert(serviceAccount),
  });
};

const deleteRoomSdk = async (db, roomId) => {
  const playersSnapshot = await db.collection('rooms').doc(roomId).collection('players').get();
  const batch = db.batch();

  playersSnapshot.forEach(playerDoc => {
    batch.delete(playerDoc.ref);
  });

  batch.delete(db.collection('rooms').doc(roomId));
  await batch.commit();
};

const pruneRoomUserRefs = ({ roomData, uid }) => {
  const answeredPlayerIds = Array.isArray(roomData.answeredPlayerIds)
    ? roomData.answeredPlayerIds.filter(playerId => playerId !== uid)
    : [];

  return {
    playerCount: Math.max(0, (roomData.playerCount ?? 1) - 1),
    answeredPlayerIds,
    winnerPlayerId: roomData.winnerPlayerId === uid ? null : (roomData.winnerPlayerId ?? null),
    updatedAt: FieldValue.serverTimestamp(),
  };
};

const cleanupUserWithSdk = async ({ uid, email, projectId }) => {
  const app = getAdminApp();
  if (!app) {
    return false;
  }

  const auth = getAuth(app);
  const db = getFirestore(app);

  const hostedRooms = await db.collection('rooms').where('hostId', '==', uid).get();
  for (const roomDoc of hostedRooms.docs) {
    await deleteRoomSdk(db, roomDoc.id);
  }

  const roomsSnapshot = await db.collection('rooms').get();
  for (const roomDoc of roomsSnapshot.docs) {
    const playerRef = db.collection('rooms').doc(roomDoc.id).collection('players').doc(uid);
    const playerSnapshot = await playerRef.get();
    if (!playerSnapshot.exists) {
      continue;
    }

    await playerRef.delete();
    const roomData = roomDoc.data();
    await roomDoc.ref.set(pruneRoomUserRefs({ roomData, uid }), { merge: true });
  }

  await db.collection('users').doc(uid).delete().catch(() => {});
  await auth.deleteUser(uid);
  console.log(`Deleted Firebase Auth + Firestore data for ${email || uid}`);
  return true;
};

const fetchUserWithRest = async ({ email, uid, projectId, accessToken }) => {
  const lookupUrl = `https://identitytoolkit.googleapis.com/v1/projects/${projectId}/accounts:lookup`;
  const body = email ? { email: [email] } : { localId: [uid] };
  let activeToken = accessToken;
  let lookup;

  try {
    lookup = await requestJson(lookupUrl, {
      method: 'POST',
      headers: { Authorization: `Bearer ${activeToken}` },
      body,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (!message.includes('invalid authentication credentials')) {
      throw error;
    }

    activeToken = ensureFreshFirebaseCliToken();
    if (!activeToken) {
      throw error;
    }

    lookup = await requestJson(lookupUrl, {
      method: 'POST',
      headers: { Authorization: `Bearer ${activeToken}` },
      body,
    });
  }

  return Array.isArray(lookup.users) && lookup.users.length > 0 ? lookup.users[0] : null;
};

const listRoomsRest = async ({ projectId, accessToken }) => {
  const url = `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents/rooms?pageSize=1000`;
  const response = await requestJson(url, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  return Array.isArray(response.documents) ? response.documents : [];
};

const listPlayersRest = async ({ projectId, accessToken, roomId }) => {
  const url = `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents/rooms/${roomId}/players?pageSize=1000`;
  const response = await requestJson(url, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  return Array.isArray(response.documents) ? response.documents : [];
};

const deleteDocumentRest = async ({ projectId, accessToken, documentPath }) => {
  const url = `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents/${documentPath}`;
  await requestJson(url, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${accessToken}` },
  }).catch(() => {});
};

const patchRoomCountRest = async ({ projectId, accessToken, roomId, playerCount }) => {
  const url = `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents/rooms/${roomId}?updateMask.fieldPaths=playerCount&updateMask.fieldPaths=answeredPlayerIds&updateMask.fieldPaths=winnerPlayerId`;
  await requestJson(url, {
    method: 'PATCH',
    headers: { Authorization: `Bearer ${accessToken}` },
    body: {
      fields: {
        playerCount: { integerValue: String(Math.max(0, playerCount)) },
        answeredPlayerIds: { arrayValue: { values: [] } },
        winnerPlayerId: { nullValue: null },
      },
    },
  });
};

const patchRoomUserRefsRest = async ({ projectId, accessToken, roomId, roomFields, uid }) => {
  const answered = Array.isArray(roomFields.answeredPlayerIds?.arrayValue?.values)
    ? roomFields.answeredPlayerIds.arrayValue.values
        .map(item => item.stringValue)
        .filter(Boolean)
        .filter(playerId => playerId !== uid)
    : [];

  const playerCount = Number(roomFields.playerCount?.integerValue ?? roomFields.playerCount?.stringValue ?? 0);
  const winnerId = roomFields.winnerPlayerId?.stringValue ?? null;

  const url = `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents/rooms/${roomId}?updateMask.fieldPaths=playerCount&updateMask.fieldPaths=answeredPlayerIds&updateMask.fieldPaths=winnerPlayerId`;
  await requestJson(url, {
    method: 'PATCH',
    headers: { Authorization: `Bearer ${accessToken}` },
    body: {
      fields: {
        playerCount: { integerValue: String(Math.max(0, playerCount - 1)) },
        answeredPlayerIds: {
          arrayValue: {
            values: answered.map(playerId => ({ stringValue: playerId })),
          },
        },
        winnerPlayerId: winnerId === uid ? { nullValue: null } : { stringValue: winnerId ?? '' },
      },
    },
  });
};

const deleteRoomRest = async ({ projectId, accessToken, roomId }) => {
  const players = await listPlayersRest({ projectId, accessToken, roomId });
  for (const playerDoc of players) {
    const pathParts = playerDoc.name.split('/documents/')[1];
    await deleteDocumentRest({ projectId, accessToken, documentPath: pathParts });
  }

  await deleteDocumentRest({ projectId, accessToken, documentPath: `rooms/${roomId}` });
};

const cleanupUserWithRest = async ({ uid, email, projectId }) => {
  let accessToken = readFirebaseCliAccessToken();
  if (!accessToken) {
    throw new Error('Missing Firebase admin credentials and no Firebase CLI token was found.');
  }

  const rooms = await listRoomsRest({ projectId, accessToken });
  for (const roomDoc of rooms) {
    const roomPath = roomDoc.name.split('/documents/')[1];
    const roomId = roomPath.split('/')[1];
    const fields = roomDoc.fields || {};
    const hostId = fields.hostId?.stringValue;
    const playerCount = Number(fields.playerCount?.integerValue ?? fields.playerCount?.stringValue ?? 0);

    if (hostId === uid) {
      await deleteRoomRest({ projectId, accessToken, roomId });
      continue;
    }

    const players = await listPlayersRest({ projectId, accessToken, roomId });
    const matchingPlayer = players.find(playerDoc => playerDoc.name.endsWith(`/players/${uid}`));
    if (!matchingPlayer) {
      continue;
    }

    const documentPath = matchingPlayer.name.split('/documents/')[1];
    await deleteDocumentRest({ projectId, accessToken, documentPath });
    await patchRoomUserRefsRest({ projectId, accessToken, roomId, roomFields: fields, uid });
  }

  await deleteDocumentRest({ projectId, accessToken, documentPath: `users/${uid}` });

  const deleteAuthUrl = `https://identitytoolkit.googleapis.com/v1/projects/${projectId}/accounts:delete`;
  try {
    await requestJson(deleteAuthUrl, {
      method: 'POST',
      headers: { Authorization: `Bearer ${accessToken}` },
      body: { localId: uid },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (!message.includes('invalid authentication credentials')) {
      throw error;
    }

    accessToken = ensureFreshFirebaseCliToken();
    if (!accessToken) {
      throw error;
    }

    await requestJson(deleteAuthUrl, {
      method: 'POST',
      headers: { Authorization: `Bearer ${accessToken}` },
      body: { localId: uid },
    });
  }

  console.log(`Deleted Firebase Auth + Firestore data for ${email || uid}`);
};

const main = async () => {
  const args = parseArgs(process.argv.slice(2));
  const { projectId } = resolveProjectConfig(args);
  const email = args.email;
  const directUid = args.uid;

  if (!projectId) {
    throw new Error('Missing FIREBASE_PROJECT_ID.');
  }

  if (!email && !directUid) {
    throw new Error('Usage: npm run admin:delete-user -- --email user@example.com OR --uid firebaseUid');
  }

  const accessToken = readFirebaseCliAccessToken();
  let targetUser = null;

  if (accessToken) {
    targetUser = await fetchUserWithRest({ email, uid: directUid, projectId, accessToken });
  }

  if (!targetUser && getAdminApp()) {
    const auth = getAuth(getAdminApp());
    targetUser = email ? await auth.getUserByEmail(email) : await auth.getUser(directUid);
  }

  if (!targetUser) {
    throw new Error('User not found.');
  }

  const uid = targetUser.localId || targetUser.uid;
  const resolvedEmail = targetUser.email || email || null;

  const deletedWithSdk = await cleanupUserWithSdk({ uid, email: resolvedEmail, projectId });
  if (deletedWithSdk) {
    return;
  }

  await cleanupUserWithRest({ uid, email: resolvedEmail, projectId });
};

main().catch(error => {
  console.error(error.message || error);
  process.exitCode = 1;
});