import { CategoryId, AppUserRecord } from '../../types';
import { FREE_CATEGORY_IDS } from '../../constants';

const ALL_CATEGORIES_WILDCARD = '*';

// `globalUnlockActive` (computed by the caller via appConfigService's
// isGlobalUnlockActive) grants everyone access during an admin-scheduled
// promo window. It's purely additive — it never revokes an individual
// user's own paid entitlement, and a user's paid entitlement keeps working
// on its own schedule regardless of the global window's state.
export const hasCategoryAccess = (
  userRecord: AppUserRecord | null,
  categoryId: CategoryId,
  nowMs: number = Date.now(),
  globalUnlockActive: boolean = false,
): boolean => {
  if (FREE_CATEGORY_IDS.includes(categoryId)) {
    return true;
  }

  if (globalUnlockActive) {
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
  globalUnlockActive: boolean = false,
): CategoryId[] => allCategoryIds.filter(id => !hasCategoryAccess(userRecord, id, nowMs, globalUnlockActive));

export const isSubscriptionActive = (userRecord: AppUserRecord | null, nowMs: number = Date.now()): boolean =>
  Boolean(userRecord && !userRecord.isGuest && userRecord.entitlementExpiresAtMs && userRecord.entitlementExpiresAtMs > nowMs);
