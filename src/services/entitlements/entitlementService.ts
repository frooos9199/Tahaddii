import { CategoryId, AppUserRecord } from '../../types';
import { FREE_CATEGORY_IDS } from '../../constants';

const ALL_CATEGORIES_WILDCARD = '*';

export const hasCategoryAccess = (
  userRecord: AppUserRecord | null,
  categoryId: CategoryId,
  nowMs: number = Date.now(),
): boolean => {
  if (FREE_CATEGORY_IDS.includes(categoryId)) {
    return true;
  }

  if (!userRecord || userRecord.isGuest) {
    return false;
  }

  if (userRecord.isAdmin || userRecord.isSuperAdmin) {
    return true;
  }

  const unlockedCategoryIds = userRecord.unlockedCategoryIds ?? [];
  if (!unlockedCategoryIds.includes(ALL_CATEGORIES_WILDCARD) && !unlockedCategoryIds.includes(categoryId)) {
    return false;
  }

  return Boolean(userRecord.entitlementExpiresAtMs && userRecord.entitlementExpiresAtMs > nowMs);
};

export const getLockedCategoryIds = (
  userRecord: AppUserRecord | null,
  allCategoryIds: CategoryId[],
  nowMs: number = Date.now(),
): CategoryId[] => allCategoryIds.filter(id => !hasCategoryAccess(userRecord, id, nowMs));

export const isSubscriptionActive = (userRecord: AppUserRecord | null, nowMs: number = Date.now()): boolean =>
  Boolean(userRecord && !userRecord.isGuest && userRecord.entitlementExpiresAtMs && userRecord.entitlementExpiresAtMs > nowMs);
