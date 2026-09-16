import { getAuthErrorTranslationKey } from '../src/utils/authError';

describe('getAuthErrorTranslationKey', () => {
  it.each([
    ['auth/invalid-email', 'auth.errors.invalidEmail'],
    ['auth/email-already-in-use', 'auth.errors.emailInUse'],
    ['auth/weak-password', 'auth.errors.weakPassword'],
    ['auth/network-request-failed', 'auth.errors.networkFailed'],
    ['auth/too-many-requests', 'auth.errors.tooManyRequests'],
  ])('maps %s to %s', (code, expectedKey) => {
    expect(getAuthErrorTranslationKey({ code })).toBe(expectedKey);
  });

  it.each(['auth/invalid-credential', 'auth/user-not-found', 'auth/wrong-password'])(
    'uses one clear message for invalid login code %s',
    code => {
      expect(getAuthErrorTranslationKey({ code })).toBe('auth.errors.invalidCredentials');
    },
  );

  it('falls back safely for unknown errors', () => {
    expect(getAuthErrorTranslationKey(new Error('raw server message'))).toBe('auth.errors.unknown');
    expect(getAuthErrorTranslationKey({ code: 'auth/new-code' })).toBe('auth.errors.unknown');
  });
});