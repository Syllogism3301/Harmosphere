import { Inject, Injectable, BadRequestException, ServiceUnavailableException } from '@nestjs/common';
import { createCipheriv, createDecipheriv, hkdfSync, randomBytes } from 'node:crypto';
import { CONFIG, Config } from '../config';
import { hash, token } from '../common/security';
import { AccountRepository, Purpose } from './account.repository';
import { hashPassword } from './passwords';
import { Locale } from '../quiz/definition';
export type Mail = { to: string; purpose: Purpose; link: string; expiresInMinutes: number };

@Injectable()
export class AccountService {
  constructor(@Inject(AccountRepository) private readonly repo: AccountRepository, @Inject(CONFIG) private readonly c: Config) {}
  private key() { return Buffer.from(hkdfSync('sha256', this.c.JWT_SECRET, 'harmosphere-mail-v1', 'outbox-encryption', 32)); }
  private encrypt(mail: Mail) {
    const iv = randomBytes(12); const cipher = createCipheriv('aes-256-gcm', this.key(), iv);
    const body = Buffer.concat([cipher.update(JSON.stringify(mail), 'utf8'), cipher.final()]);
    return [iv, cipher.getAuthTag(), body].map(x => x.toString('base64url')).join('.');
  }
  decryptMail(encoded: string): Mail {
    const [iv, tag, body] = encoded.split('.').map(v => Buffer.from(v, 'base64url'));
    const decipher = createDecipheriv('aes-256-gcm', this.key(), iv); decipher.setAuthTag(tag);
    return JSON.parse(Buffer.concat([decipher.update(body), decipher.final()]).toString('utf8'));
  }
  private available() {
    if (!this.c.LOCAL_MAILBOX || this.c.NODE_ENV === 'production') throw new ServiceUnavailableException('EMAIL_DELIVERY_UNAVAILABLE');
  }
  async profile(id: string) {
    const user = await this.repo.profile(id);
    return { ...user, canEdit: this.c.NODE_ENV !== 'production' && !!user?.email_verified_at && !!this.c.LOCAL_EDITOR_EMAIL && user.email === this.c.LOCAL_EDITOR_EMAIL };
  }
  private async issue(user: { id: string; email: string }, purpose: Purpose, locale: Locale) {
    const raw = token();
    const route = purpose === 'RESET_PASSWORD' ? 'reset-password' : 'verify-email';
    // Fragment keeps the token out of access logs and HTTP referrers. Consumption is POST-only.
    const link = `${this.c.WEB_ORIGIN}/${locale}/${route}#token=${raw}`;
    await this.repo.issue(user.id, purpose, hash(raw), this.encrypt({ to: user.email, purpose, link, expiresInMinutes: 15 }));
  }
  async requestReset(email: string, locale: Locale) {
    this.available();
    const user = await this.repo.byEmail(email.trim().toLowerCase());
    if (user) await this.issue(user, 'RESET_PASSWORD', locale);
    return { ok: true }; // Never expose account existence or the token.
  }
  async requestVerification(userId: string, locale: Locale) {
    this.available();
    const user = await this.repo.profile(userId);
    if (user && !user.email_verified_at) await this.issue(user, 'VERIFY_EMAIL', locale);
    return { ok: true };
  }
  async reset(raw: string, password: string) {
    const passwordHash = await hashPassword(password);
    if (!await this.repo.consume(hash(raw), 'RESET_PASSWORD', passwordHash)) throw new BadRequestException('TOKEN_INVALID_OR_EXPIRED');
    return { ok: true };
  }
  async verify(raw: string) {
    if (!await this.repo.consume(hash(raw), 'VERIFY_EMAIL')) throw new BadRequestException('TOKEN_INVALID_OR_EXPIRED');
    return { ok: true };
  }
}
