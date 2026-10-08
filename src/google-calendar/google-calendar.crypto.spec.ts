import {
  decryptSecret,
  encryptSecret,
  sameState,
} from './google-calendar.crypto';

describe('Google Calendar credential protection', () => {
  const key = 'ab'.repeat(32);
  it('encrypts tokens with a different nonce and restores them', () => {
    const first = encryptSecret('refresh-secret', key);
    expect(first).not.toContain('refresh-secret');
    expect(encryptSecret('refresh-secret', key)).not.toBe(first);
    expect(decryptSecret(first, key)).toBe('refresh-secret');
  });
  it('rejects tampered ciphertext and a different key', () => {
    const secret = encryptSecret('refresh-secret', key);
    expect(() => decryptSecret(secret, 'cd'.repeat(32))).toThrow();
    const parts = secret.split('.');
    parts[1] = Buffer.alloc(16).toString('base64url');
    expect(() => decryptSecret(parts.join('.'), key)).toThrow();
  });
  it('checks browser-bound state even when lengths differ', () => {
    expect(sameState('one', 'one')).toBe(true);
    expect(sameState('one', 'different')).toBe(false);
  });
});
