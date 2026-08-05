import { get, push, ref, set, update } from 'firebase/database';
import { getFirebaseRealtimeDb, isFirebaseConfigured } from '../firebase/firebaseClient';

export interface SponsorAd {
  id: string;
  companyName: string;
  headlineAr: string;
  headlineEn: string;
  imageUrl: string;
  accentColor: string;
  isActive: boolean;
  priority: number;
  createdAtMs: number;
  updatedAtMs: number;
}

export interface SponsorAdInput {
  id?: string;
  companyName: string;
  headlineAr: string;
  headlineEn?: string;
  imageUrl?: string;
  accentColor?: string;
  isActive?: boolean;
  priority?: number;
}

const SPONSOR_ADS_PATH = 'sponsorAds';

const toSponsorAd = (id: string, payload: any): SponsorAd => ({
  id,
  companyName: String(payload.companyName ?? '').trim(),
  headlineAr: String(payload.headlineAr ?? '').trim(),
  headlineEn: String(payload.headlineEn ?? payload.headlineAr ?? '').trim(),
  imageUrl: String(payload.imageUrl ?? '').trim(),
  accentColor: String(payload.accentColor ?? '#f59e0b').trim() || '#f59e0b',
  isActive: payload.isActive !== false,
  priority: Number(payload.priority ?? 0),
  createdAtMs: Number(payload.createdAtMs ?? 0),
  updatedAtMs: Number(payload.updatedAtMs ?? 0),
});

export const listSponsorAds = async (): Promise<SponsorAd[]> => {
  if (!isFirebaseConfigured()) return [];

  const snapshot = await get(ref(getFirebaseRealtimeDb(), SPONSOR_ADS_PATH));
  const value = snapshot.val() ?? {};
  return Object.entries(value)
    .map(([id, payload]) => toSponsorAd(id, payload))
    .sort((left, right) => right.priority - left.priority || right.updatedAtMs - left.updatedAtMs);
};

export const saveSponsorAd = async (input: SponsorAdInput) => {
  const companyName = input.companyName.trim();
  const headlineAr = input.headlineAr.trim();
  const headlineEn = input.headlineEn?.trim() || headlineAr;

  if (!companyName) throw new Error('اكتب اسم الشركة');
  if (!headlineAr) throw new Error('اكتب نص الإعلان');

  const db = getFirebaseRealtimeDb();
  const now = Date.now();
  const payload = {
    companyName,
    headlineAr,
    headlineEn,
    imageUrl: input.imageUrl?.trim() || '',
    accentColor: input.accentColor?.trim() || '#f59e0b',
    isActive: input.isActive ?? true,
    priority: Number(input.priority ?? 0),
    updatedAtMs: now,
    createdAtMs: now,
  };

  if (input.id) {
    await update(ref(db, `${SPONSOR_ADS_PATH}/${input.id}`), {
      companyName: payload.companyName,
      headlineAr: payload.headlineAr,
      headlineEn: payload.headlineEn,
      imageUrl: payload.imageUrl,
      accentColor: payload.accentColor,
      isActive: payload.isActive,
      priority: payload.priority,
      updatedAtMs: payload.updatedAtMs,
    });
    return input.id;
  }

  const adRef = push(ref(db, SPONSOR_ADS_PATH));
  await set(adRef, payload);
  return adRef.key;
};

export const setSponsorAdActive = async (id: string, isActive: boolean) => {
  await update(ref(getFirebaseRealtimeDb(), `${SPONSOR_ADS_PATH}/${id}`), {
    isActive,
    updatedAtMs: Date.now(),
  });
};
