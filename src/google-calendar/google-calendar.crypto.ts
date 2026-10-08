import {
  createCipheriv,
  createDecipheriv,
  createHash,
  randomBytes,
  timingSafeEqual,
} from 'node:crypto';

export function hashState(value: string): string {
  return createHash('sha256').update(value).digest('hex');
}

export function sameState(left: string, right: string): boolean {
  return timingSafeEqual(
    Buffer.from(hashState(left)),
    Buffer.from(hashState(right)),
  );
}

export function encryptSecret(value: string, keyHex: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', Buffer.from(keyHex, 'hex'), iv);
  const encrypted = Buffer.concat([
    cipher.update(value, 'utf8'),
    cipher.final(),
  ]);
  return [iv, cipher.getAuthTag(), encrypted]
    .map((part) => part.toString('base64url'))
    .join('.');
}

export function decryptSecret(value: string, keyHex: string): string {
  const [iv, tag, encrypted] = value
    .split('.')
    .map((part) => Buffer.from(part, 'base64url'));
  const decipher = createDecipheriv(
    'aes-256-gcm',
    Buffer.from(keyHex, 'hex'),
    iv,
  );
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(encrypted), decipher.final()]).toString(
    'utf8',
  );
}
