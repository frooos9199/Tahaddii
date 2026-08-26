import { collection, getDocs, orderBy, query } from 'firebase/firestore';
import { PromoCode, PromoCodeType } from '../../types';
import { getFirebaseDb, isFirebaseConfigured } from '../firebase/firebaseClient';
import { callFunction } from '../functions/functionsClient';

const PROMO_CODES_COLLECTION = 'promoCodes';

const toPromoCode = (id: string, payload: any): PromoCode => ({
  code: String(payload.code ?? id),
  type: payload.type,
  discountValue: payload.discountValue ?? null,
  packageId: payload.packageId ?? null,
  maxRedemptions: Number(payload.maxRedemptions ?? 1),
  redemptionCount: Number(payload.redemptionCount ?? 0),
  expiresAtMs: payload.expiresAtMs ?? null,
  isActive: payload.isActive !== false,
  createdByAdminUid: payload.createdByAdminUid,
  createdAtMs: Number(payload.createdAtMs ?? 0),
});

export const listPromoCodes = async (): Promise<PromoCode[]> => {
  if (!isFirebaseConfigured()) return [];

  const db = getFirebaseDb();
  const snapshot = await getDocs(query(collection(db, PROMO_CODES_COLLECTION), orderBy('createdAtMs', 'desc'))).catch(() => null);
  if (!snapshot) return [];

  return snapshot.docs.map(codeDoc => toPromoCode(codeDoc.id, codeDoc.data()));
};

export const createPromoCode = async (input: {
  code: string;
  type: PromoCodeType;
  discountValue?: number;
  packageId?: string;
  maxRedemptions?: number;
  expiresAtMs?: number | null;
}) => {
  const result = await callFunction('createPromoCode', {
    code: input.code,
    type: input.type,
    discountValue: input.discountValue,
    packageId: input.packageId,
    maxRedemptions: input.maxRedemptions,
    expiresAtMs: input.expiresAtMs,
  }) as { code: string };
  return result.code;
};

export const deactivatePromoCode = async (code: string) => {
  await callFunction('deactivatePromoCode', { code });
};

export const generateRandomCode = (length = 8) => {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  return Array.from({ length }, () => alphabet[Math.floor(Math.random() * alphabet.length)]).join('');
};
