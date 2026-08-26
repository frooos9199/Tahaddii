import { doc, getDoc, setDoc } from 'firebase/firestore';
import { getFirebaseDb, isFirebaseConfigured } from '../firebase/firebaseClient';

const APP_CONFIG_COLLECTION = 'appConfig';
const CONTACT_DOC_ID = 'contact';

export interface ContactConfig {
  whatsappNumber: string; // digits only, international format, e.g. "96550000000"
}

export const getContactConfig = async (): Promise<ContactConfig> => {
  if (!isFirebaseConfigured()) return { whatsappNumber: '' };

  const snapshot = await getDoc(doc(getFirebaseDb(), APP_CONFIG_COLLECTION, CONTACT_DOC_ID)).catch(() => null);
  const data = snapshot?.data();
  return { whatsappNumber: String(data?.whatsappNumber ?? '').trim() };
};

export const saveContactConfig = async (whatsappNumber: string) => {
  const digitsOnly = whatsappNumber.replace(/[^0-9]/g, '');
  await setDoc(doc(getFirebaseDb(), APP_CONFIG_COLLECTION, CONTACT_DOC_ID), {
    whatsappNumber: digitsOnly,
    updatedAtMs: Date.now(),
  }, { merge: true });
};

export const buildWhatsAppUrl = (whatsappNumber: string, message: string) =>
  `https://wa.me/${whatsappNumber}?text=${encodeURIComponent(message)}`;
