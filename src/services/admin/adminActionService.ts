import { getFirebaseAuth } from '../firebase/firebaseClient';

type Role = 'user' | 'admin' | 'super_admin';

const PROJECT = 'tahaddi-77a5d';
const REGION = 'us-central1';

// Direct HTTP call to Gen-1 callable — bypasses Firebase Functions SDK quirks in React Native.
const callFunction = async (name: string, data: Record<string, unknown>) => {
  const user = getFirebaseAuth().currentUser;
  const token = user ? await user.getIdToken(true) : null;

  const url = `https://${REGION}-${PROJECT}.cloudfunctions.net/${name}`;
  const resp = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify({ data }),
  });

  const json = (await resp.json()) as { result?: unknown; error?: { status?: string; message?: string } };
  if (json.error) {
    throw new Error(`${json.error.status ?? 'ERROR'}: ${json.error.message ?? 'Unknown error'}`);
  }
  return json.result;
};

export const setUserRoleDirectly = async ({
  email,
  uid,
  role,
}: {
  email?: string | null;
  uid?: string;
  role: Role;
}) => {
  await callFunction('setUserRole', { email: email ?? undefined, uid, role });
};

export const deleteUserDirectly = async ({
  email,
  uid,
}: {
  email?: string | null;
  uid?: string;
}) => {
  await callFunction('deleteUserFully', { email: email ?? undefined, uid });
};
