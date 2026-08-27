import { doc, getDoc, setDoc } from 'firebase/firestore';
import { getFirebaseDb, isFirebaseConfigured } from '../firebase/firebaseClient';

const APP_CONFIG_COLLECTION = 'appConfig';
const CONTACT_DOC_ID = 'contact';
const ENTITLEMENTS_DOC_ID = 'entitlements';

export interface ContactConfig {
  whatsappNumber: string; // digits only, international format, e.g. "96550000000"
}

export interface EntitlementsConfig {
  globalUnlockEnabled: boolean;
  globalUnlockStartAtMs: number | null;
  globalUnlockEndAtMs: number | null;
  newUserTrialEnabled: boolean;
  newUserTrialDays: number;
}

const DEFAULT_ENTITLEMENTS_CONFIG: EntitlementsConfig = {
  globalUnlockEnabled: false,
  globalUnlockStartAtMs: null,
  globalUnlockEndAtMs: null,
  newUserTrialEnabled: false,
  newUserTrialDays: 7,
};

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

export const getEntitlementsConfig = async (): Promise<EntitlementsConfig> => {
  if (!isFirebaseConfigured()) return DEFAULT_ENTITLEMENTS_CONFIG;

  const snapshot = await getDoc(doc(getFirebaseDb(), APP_CONFIG_COLLECTION, ENTITLEMENTS_DOC_ID)).catch(() => null);
  const data = snapshot?.data();
  if (!data) return DEFAULT_ENTITLEMENTS_CONFIG;

  return {
    globalUnlockEnabled: Boolean(data.globalUnlockEnabled),
    globalUnlockStartAtMs: data.globalUnlockStartAtMs ?? null,
    globalUnlockEndAtMs: data.globalUnlockEndAtMs ?? null,
    newUserTrialEnabled: Boolean(data.newUserTrialEnabled),
    newUserTrialDays: Number(data.newUserTrialDays ?? 7),
  };
};

export const saveEntitlementsConfig = async (config: EntitlementsConfig) => {
  await setDoc(doc(getFirebaseDb(), APP_CONFIG_COLLECTION, ENTITLEMENTS_DOC_ID), {
    ...config,
    updatedAtMs: Date.now(),
  }, { merge: true });
};

export const isGlobalUnlockActive = (config: EntitlementsConfig, nowMs: number = Date.now()): boolean =>
  Boolean(
    config.globalUnlockEnabled
    && config.globalUnlockStartAtMs != null && nowMs >= config.globalUnlockStartAtMs
    && config.globalUnlockEndAtMs != null && nowMs <= config.globalUnlockEndAtMs,
  );
