import { callFunction } from '../functions/functionsClient';
import { CategoryId } from '../../types';

export const grantEntitlementDirectly = async ({
  uids,
  categoryIds,
  expiresAtMs,
  mode,
  note,
  packageId,
}: {
  uids: string[];
  categoryIds: CategoryId[];
  expiresAtMs: number;
  mode: 'extend' | 'replace';
  note?: string;
  packageId?: string;
}) => {
  const result = await callFunction('grantEntitlement', { uids, categoryIds, expiresAtMs, mode, note, packageId });
  return result as { results: Array<{ uid: string; ok: boolean; error?: string; unlockedCategoryIds?: CategoryId[]; entitlementExpiresAtMs?: number }> };
};
