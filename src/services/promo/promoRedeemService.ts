import { callFunction } from '../functions/functionsClient';

export type PromoRedemptionResult =
  | { status: 'granted'; packageNameAr: string; packageNameEn: string; categoryIds: string[]; expiresAtMs: number }
  | { status: 'discount'; type: 'discountPercent' | 'discountFixedKwd'; discountValue: number | null };

export const redeemPromoCode = async (code: string): Promise<PromoRedemptionResult> => {
  const result = await callFunction('redeemPromoCode', { code: code.trim().toUpperCase() });
  return result as PromoRedemptionResult;
};
