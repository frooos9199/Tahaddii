import {
  User,
  createUserWithEmailAndPassword,
  signInAnonymously,
  signInWithEmailAndPassword,
  signOut,
  updateProfile,
} from 'firebase/auth';
import { doc, getDoc, serverTimestamp, setDoc } from 'firebase/firestore';
import { AppUserRecord } from '../../types';
import { getFirebaseAuth, getFirebaseDb, isFirebaseConfigured } from '../firebase/firebaseClient';
import { callFunction } from '../functions/functionsClient';

const USERS_COLLECTION = 'users';

const resolveRoleFromToken = async (user: User) => {
  const tokenResult = await user.getIdTokenResult();
  const claimRole = tokenResult.claims.role;

  if (claimRole === 'super_admin') {
    return {
      role: 'super_admin' as const,
      roles: ['super_admin'] as const,
      isAdmin: true,
      isSuperAdmin: true,
    };
  }

  if (claimRole === 'admin' || tokenResult.claims.isAdmin === true) {
    return {
      role: 'admin' as const,
      roles: ['admin'] as const,
      isAdmin: true,
      isSuperAdmin: false,
    };
  }

  return {
    role: 'user' as const,
    roles: ['user'] as const,
    isAdmin: false,
    isSuperAdmin: false,
  };
};

const toDisplayName = (user: User, displayName?: string) => {
  const trimmed = displayName?.trim();
  if (trimmed) {
    return trimmed;
  }

  if (user.displayName?.trim()) {
    return user.displayName.trim();
  }

  if (user.email) {
    return user.email.split('@')[0];
  }

  return 'Guest';
};

// Guests (anonymous auth) never get a Firestore document — this keeps the
// `users` collection limited to real (email/password) accounts and avoids
// unbounded storage/read/write growth from one-time visitors. Anonymous users
// still get a Firebase Auth UID (needed for online rooms/presence), just no
// persisted Firestore record.
const buildGuestUserRecord = (user: User, displayName?: string): AppUserRecord => ({
  uid: user.uid,
  email: null,
  displayName: toDisplayName(user, displayName),
  avatarUri: user.photoURL ?? null,
  role: 'user',
  roles: ['user'],
  isAdmin: false,
  isSuperAdmin: false,
  isGuest: true,
  authProvider: 'anonymous',
});

export const ensureUserDocument = async (user: User, displayName?: string): Promise<AppUserRecord> => {
  if (!isFirebaseConfigured()) {
    throw new Error('Firebase not configured');
  }

  if (user.isAnonymous) {
    return buildGuestUserRecord(user, displayName);
  }

  const db = getFirebaseDb();
  const userRef = doc(db, USERS_COLLECTION, user.uid);
  const existingSnapshot = await getDoc(userRef);
  const existingData = existingSnapshot.exists() ? existingSnapshot.data() as Partial<AppUserRecord> : {};
  const resolvedDisplayName = toDisplayName(user, displayName);
  const tokenRole = await resolveRoleFromToken(user);

  const payload: AppUserRecord & { createdAt?: unknown; updatedAt: unknown } = {
    uid: user.uid,
    email: user.email ?? null,
    displayName: resolvedDisplayName,
    role: tokenRole.role,
    roles: [...tokenRole.roles],
    isAdmin: tokenRole.isAdmin,
    isSuperAdmin: tokenRole.isSuperAdmin,
    isGuest: false,
    authProvider: 'password',
    updatedAt: serverTimestamp(),
  };

  const isFirstEverDoc = !existingSnapshot.exists();
  if (isFirstEverDoc) {
    payload.createdAt = serverTimestamp();
  }

  await setDoc(userRef, payload, { merge: true });

  let customerNumber = existingData.customerNumber;
  let unlockedCategoryIds = existingData.unlockedCategoryIds ?? [];
  let entitlementExpiresAtMs = existingData.entitlementExpiresAtMs ?? null;
  let entitlementSource = existingData.entitlementSource ?? null;
  if (isFirstEverDoc) {
    // Assign a sequential customer number (starting at 3000) so the admin can
    // identify a paying customer by number when they message about a payment.
    // This same call may also grant a configured new-user trial entitlement.
    try {
      const result = await callFunction('assignCustomerNumberDirectly', {}) as {
        customerNumber?: number;
        trialGranted?: boolean;
      } | undefined;
      customerNumber = result?.customerNumber ?? customerNumber;
      if (result?.trialGranted) {
        const freshSnapshot = await getDoc(userRef);
        const freshData = freshSnapshot.data() as Partial<AppUserRecord> | undefined;
        unlockedCategoryIds = freshData?.unlockedCategoryIds ?? unlockedCategoryIds;
        entitlementExpiresAtMs = freshData?.entitlementExpiresAtMs ?? entitlementExpiresAtMs;
        entitlementSource = freshData?.entitlementSource ?? entitlementSource;
      }
    } catch (error) {
      console.warn('Failed to assign customer number', error);
    }
  }

  return {
    uid: user.uid,
    email: user.email ?? null,
    displayName: resolvedDisplayName,
    avatarUri: existingData.avatarUri ?? user.photoURL ?? null,
    avatarEmoji: existingData.avatarEmoji,
    color: existingData.color,
    role: tokenRole.role,
    roles: [...tokenRole.roles],
    isAdmin: tokenRole.isAdmin,
    isSuperAdmin: tokenRole.isSuperAdmin,
    isGuest: false,
    authProvider: 'password',
    customerNumber,
    unlockedCategoryIds,
    entitlementExpiresAtMs,
    entitlementSource,
  };
};

export const ensureAuthenticatedUser = async ({
  allowGuest = true,
  displayName,
}: {
  allowGuest?: boolean;
  displayName?: string;
} = {}): Promise<User> => {
  if (!isFirebaseConfigured()) {
    throw new Error('Firebase not configured');
  }

  const auth = getFirebaseAuth();
  if (auth.currentUser) {
    await ensureUserDocument(auth.currentUser, displayName);
    return auth.currentUser;
  }

  if (!allowGuest) {
    throw new Error('Authentication required');
  }

  const credential = await signInAnonymously(auth);
  await ensureUserDocument(credential.user, displayName);
  return credential.user;
};

export const signUpWithEmail = async ({
  email,
  password,
  displayName,
}: {
  email: string;
  password: string;
  displayName?: string;
}) => {
  const auth = getFirebaseAuth();
  const credential = await createUserWithEmailAndPassword(auth, email.trim(), password);
  if (displayName?.trim()) {
    await updateProfile(credential.user, { displayName: displayName.trim() });
  }
  await ensureUserDocument(credential.user, displayName);
  return credential.user;
};

export const signInWithEmail = async ({
  email,
  password,
}: {
  email: string;
  password: string;
}) => {
  const auth = getFirebaseAuth();
  const credential = await signInWithEmailAndPassword(auth, email.trim(), password);
  await ensureUserDocument(credential.user);
  return credential.user;
};

export const signInAsGuest = async (displayName?: string) => {
  const user = await ensureAuthenticatedUser({ allowGuest: true, displayName });
  return user;
};

export const updateCurrentUserDisplayName = async (displayName: string) => {
  const auth = getFirebaseAuth();
  const user = auth.currentUser;
  const trimmedName = displayName.trim();

  if (!user || !trimmedName) {
    return null;
  }

  await updateProfile(user, { displayName: trimmedName });
  return ensureUserDocument(user, trimmedName);
};

export const updateCurrentUserProfile = async ({
  displayName,
  avatarUri,
  avatarEmoji,
  color,
}: {
  displayName: string;
  avatarUri?: string | null;
  avatarEmoji?: string;
  color?: string;
}) => {
  const auth = getFirebaseAuth();
  const user = auth.currentUser;
  const trimmedName = displayName.trim();

  if (!user || !trimmedName) {
    return null;
  }

  await updateProfile(user, {
    displayName: trimmedName,
    photoURL: avatarUri && avatarUri.startsWith('http') ? avatarUri : user.photoURL,
  });

  if (!user.isAnonymous) {
    await setDoc(doc(getFirebaseDb(), USERS_COLLECTION, user.uid), {
      displayName: trimmedName,
      avatarUri: avatarUri ?? null,
      avatarEmoji: avatarEmoji ?? null,
      color: color ?? null,
      updatedAt: serverTimestamp(),
    }, { merge: true });
  }

  return ensureUserDocument(user, trimmedName);
};

export const signOutCurrentUser = async () => {
  const auth = getFirebaseAuth();
  await signOut(auth);
};