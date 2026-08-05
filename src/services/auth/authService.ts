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

export const ensureUserDocument = async (user: User, displayName?: string): Promise<AppUserRecord> => {
  if (!isFirebaseConfigured()) {
    throw new Error('Firebase not configured');
  }

  const db = getFirebaseDb();
  const userRef = doc(db, USERS_COLLECTION, user.uid);
  const existingSnapshot = await getDoc(userRef);
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
    isGuest: user.isAnonymous,
    authProvider: user.isAnonymous ? 'anonymous' : 'password',
    updatedAt: serverTimestamp(),
  };

  if (!existingSnapshot.exists()) {
    payload.createdAt = serverTimestamp();
  }

  await setDoc(userRef, payload, { merge: true });

  return {
    uid: user.uid,
    email: user.email ?? null,
    displayName: resolvedDisplayName,
    role: tokenRole.role,
    roles: [...tokenRole.roles],
    isAdmin: tokenRole.isAdmin,
    isSuperAdmin: tokenRole.isSuperAdmin,
    isGuest: user.isAnonymous,
    authProvider: user.isAnonymous ? 'anonymous' : 'password',
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

export const signOutCurrentUser = async () => {
  const auth = getFirebaseAuth();
  await signOut(auth);
};