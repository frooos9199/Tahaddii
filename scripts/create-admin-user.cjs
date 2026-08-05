const fs = require('fs');
const path = require('path');
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
    apiKey: args.apiKey ?? process.env.FIREBASE_API_KEY ?? env.FIREBASE_API_KEY,
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

const buildClaims = (role) => ({
  role,
  roles: [role],
  isAdmin: role === 'admin' || role === 'super_admin',
  isSuperAdmin: role === 'super_admin',
});

const fallbackDisplayName = (email, displayName) => displayName ?? email.split('@')[0];

const upsertFirestoreUserWithRest = async ({ accessToken, projectId, uid, email, displayName, role }) => {
  const now = new Date().toISOString();
  const url = `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents/users/${uid}`;

  await requestJson(url, {
    method: 'PATCH',
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
    body: {
      fields: {
        uid: { stringValue: uid },
        email: { stringValue: email },
        displayName: { stringValue: displayName },
        role: { stringValue: role },
        roles: {
          arrayValue: {
            values: [{ stringValue: role }],
          },
        },
        isAdmin: { booleanValue: role === 'admin' || role === 'super_admin' },
        isSuperAdmin: { booleanValue: role === 'super_admin' },
        isGuest: { booleanValue: false },
        authProvider: { stringValue: 'password' },
        createdAt: { timestampValue: now },
        updatedAt: { timestampValue: now },
      },
    },
  });
};

const upsertAdminUserWithRest = async ({ email, password, displayName, role, projectId }) => {
  const accessToken = readFirebaseCliAccessToken();

  if (!accessToken) {
    throw new Error(
      'Missing Firebase Admin credentials and no Firebase CLI access token was found. Run firebase login or provide a service account.',
    );
  }

  if (!projectId) {
    throw new Error('Missing FIREBASE_PROJECT_ID.');
  }

  const headers = {
    Authorization: `Bearer ${accessToken}`,
  };

  const lookupUrl = `https://identitytoolkit.googleapis.com/v1/projects/${projectId}/accounts:lookup`;
  const createUrl = `https://identitytoolkit.googleapis.com/v1/projects/${projectId}/accounts`;
  const updateUrl = `https://identitytoolkit.googleapis.com/v1/projects/${projectId}/accounts:update`;

  let localId;
  const lookup = await requestJson(lookupUrl, {
    method: 'POST',
    headers,
    body: { email: [email] },
  });

  const existingUser = Array.isArray(lookup.users) && lookup.users.length > 0 ? lookup.users[0] : null;

  if (existingUser) {
    localId = existingUser.localId;
  } else {
    if (!password) {
      throw new Error('Password is required when creating a new user.');
    }

    const created = await requestJson(createUrl, {
      method: 'POST',
      headers,
      body: {
        email,
        password,
        displayName,
        emailVerified: true,
      },
    });
    localId = created.localId;
    console.log(`Created new user: ${localId}`);
  }

  const effectiveDisplayName = fallbackDisplayName(email, displayName ?? existingUser?.displayName);

  const updated = await requestJson(updateUrl, {
    method: 'POST',
    headers,
    body: {
      localId,
      ...(password ? { password } : {}),
      displayName: effectiveDisplayName,
      email,
      emailVerified: true,
      customAttributes: JSON.stringify(buildClaims(role)),
    },
  });

  if (!existingUser) {
    await upsertFirestoreUserWithRest({ accessToken, projectId, uid: localId, email, displayName: effectiveDisplayName, role });
    console.log(`Assigned ${role} to ${email}`);
    return updated.localId ?? localId;
  }

  console.log(`Updated existing user: ${localId}`);
  await upsertFirestoreUserWithRest({ accessToken, projectId, uid: localId, email, displayName: effectiveDisplayName, role });
  console.log(`Assigned ${role} to ${email}`);
  return updated.localId ?? localId;
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

const upsertAdminUserWithSdk = async ({ email, password, displayName, role }) => {
  const app = getAdminApp();
  if (!app) {
    return false;
  }

  const auth = getAuth(app);
  const db = getFirestore(app);
  const effectiveDisplayName = fallbackDisplayName(email, displayName);

  let userRecord;
  try {
    userRecord = await auth.getUserByEmail(email);
    userRecord = await auth.updateUser(userRecord.uid, {
      ...(password ? { password } : {}),
      displayName: effectiveDisplayName,
      emailVerified: true,
    });
    console.log(`Updated existing user: ${userRecord.uid}`);
  } catch (error) {
    if (error && error.code === 'auth/user-not-found') {
      if (!password) {
        throw new Error('Password is required when creating a new user.');
      }

      userRecord = await auth.createUser({
        email,
        password,
        displayName: effectiveDisplayName,
        emailVerified: true,
      });
      console.log(`Created new user: ${userRecord.uid}`);
    } else {
      throw error;
    }
  }

  await auth.setCustomUserClaims(userRecord.uid, buildClaims(role));

  await db.collection('users').doc(userRecord.uid).set({
    uid: userRecord.uid,
    email,
    displayName: effectiveDisplayName,
    role,
    roles: [role],
    isAdmin: role === 'admin' || role === 'super_admin',
    isSuperAdmin: role === 'super_admin',
    isGuest: false,
    authProvider: 'password',
    createdAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp(),
  }, { merge: true });

  console.log(`Assigned ${role} to ${email}`);
  return true;
};

const main = async () => {
  const args = parseArgs(process.argv.slice(2));
  const email = args.email;
  const password = args.password;
  const displayName = args.name;
  const role = args.role ?? 'super_admin';
  const { projectId } = resolveProjectConfig(args);

  if (!email) {
    throw new Error('Usage: npm run admin:set-role -- --email user@example.com [--password strong-password] [--name "Name"] [--role user|admin|super_admin]');
  }

  const updatedWithSdk = await upsertAdminUserWithSdk({ email, password, displayName, role });
  if (updatedWithSdk) {
    return;
  }

  await upsertAdminUserWithRest({ email, password, displayName, role, projectId });
};

main().catch((error) => {
  console.error(error.message || error);
  process.exitCode = 1;
});