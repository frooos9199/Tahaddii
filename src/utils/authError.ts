const AUTH_ERROR_KEYS: Record<string, string> = {
  'auth/invalid-email': 'auth.errors.invalidEmail',
  'auth/missing-email': 'auth.errors.invalidEmail',
  'auth/missing-password': 'auth.errors.missingPassword',
  'auth/weak-password': 'auth.errors.weakPassword',
  'auth/email-already-in-use': 'auth.errors.emailInUse',
  'auth/invalid-credential': 'auth.errors.invalidCredentials',
  'auth/invalid-login-credentials': 'auth.errors.invalidCredentials',
  'auth/user-not-found': 'auth.errors.invalidCredentials',
  'auth/wrong-password': 'auth.errors.invalidCredentials',
  'auth/user-disabled': 'auth.errors.userDisabled',
  'auth/too-many-requests': 'auth.errors.tooManyRequests',
  'auth/network-request-failed': 'auth.errors.networkFailed',
  'auth/operation-not-allowed': 'auth.errors.operationNotAllowed',
  'auth/credential-already-in-use': 'auth.errors.credentialInUse',
};

export const getAuthErrorTranslationKey = (error: unknown) => {
  if (typeof error !== 'object' || error === null || !('code' in error)) {
    return 'auth.errors.unknown';
  }

  const code = String(error.code).toLowerCase();
  return AUTH_ERROR_KEYS[code] ?? 'auth.errors.unknown';
};