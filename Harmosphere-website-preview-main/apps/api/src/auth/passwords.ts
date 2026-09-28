import { ConflictException } from '@nestjs/common';
import { randomBytes, scrypt, timingSafeEqual } from 'node:crypto';

function derive(password: string, salt: string): Promise<Buffer> {
  return new Promise((resolve, reject) => scrypt(password, salt, 64,
    { N: 131072, r: 8, p: 1, maxmem: 256 * 1024 * 1024 },
    (error, key) => error ? reject(error) : resolve(key)));
}
let jobs = 0;
async function bounded<T>(work: () => Promise<T>) {
  if (jobs >= 2) throw new ConflictException('AUTH_BUSY');
  jobs++;
  try { return await work(); } finally { jobs--; }
}
export async function hashPassword(password: string) {
  const salt = randomBytes(16).toString('hex');
  const digest = await bounded(() => derive(password, salt));
  return `scrypt:${salt}:${digest.toString('hex')}`;
}
export async function verifyPassword(password: string, encoded?: string) {
  const [, salt, expected] = (encoded ?? `scrypt:${'0'.repeat(32)}:${'0'.repeat(128)}`).split(':');
  const digest = await bounded(() => derive(password, salt));
  return timingSafeEqual(digest, Buffer.from(expected, 'hex')) && !!encoded;
}
