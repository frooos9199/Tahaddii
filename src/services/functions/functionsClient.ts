import { getFirebaseAuth } from '../firebase/firebaseClient';

const PROJECT = 'tahaddi-77a5d';
const REGION = 'us-central1';

// Direct HTTP call to Gen-1 callable — bypasses Firebase Functions SDK quirks in React Native.
export const callFunction = async (name: string, data: Record<string, unknown>) => {
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
