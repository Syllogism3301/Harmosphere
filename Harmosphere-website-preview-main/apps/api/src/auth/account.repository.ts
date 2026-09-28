import { Inject, Injectable } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { DATABASE, Database } from '../database/database';
export type Purpose = 'VERIFY_EMAIL' | 'RESET_PASSWORD';

@Injectable()
export class AccountRepository {
  constructor(@Inject(DATABASE) private readonly db: Database) {}

  async profile(userId: string) {
    return (await this.db.query('SELECT id,email,email_verified_at FROM users WHERE id=$1', [userId])).rows[0];
  }
  async byEmail(email: string) {
    return (await this.db.query('SELECT id,email FROM users WHERE email=$1', [email])).rows[0];
  }
  async issue(userId: string, purpose: Purpose, tokenHash: string, encrypted: string) {
    return this.db.transaction(async sql => {
      await sql.query('SELECT id FROM users WHERE id=$1 FOR UPDATE', [userId]);
      const recent = await sql.query("SELECT token_hash FROM account_tokens WHERE user_id=$1 AND purpose=$2 AND created_at>now()-interval '1 minute' LIMIT 1", [userId, purpose]);
      if (recent.rows.length) return; // Same response for throttled and newly issued requests.
      await sql.query('UPDATE account_tokens SET used_at=now() WHERE user_id=$1 AND purpose=$2 AND used_at IS NULL', [userId, purpose]);
      await sql.query("INSERT INTO account_tokens(token_hash,user_id,purpose,expires_at) VALUES($1,$2,$3,now()+interval '15 minutes')", [tokenHash, userId, purpose]);
      await sql.query('INSERT INTO mail_outbox(id,encrypted_payload) VALUES($1,$2)', [randomUUID(), encrypted]);
    });
  }
  async consume(tokenHash: string, purpose: Purpose, passwordHash?: string) {
    return this.db.transaction(async sql => {
      const candidate = (await sql.query('SELECT user_id FROM account_tokens WHERE token_hash=$1 AND purpose=$2', [tokenHash, purpose])).rows[0];
      if (!candidate) return false;
      // All account changes lock the user first, then the token, in a fixed order.
      await sql.query('SELECT id FROM users WHERE id=$1 FOR UPDATE', [candidate.user_id]);
      const active = (await sql.query('SELECT user_id FROM account_tokens WHERE token_hash=$1 AND purpose=$2 AND used_at IS NULL AND expires_at>now() FOR UPDATE', [tokenHash, purpose])).rows[0];
      if (!active) return false;
      if (purpose === 'RESET_PASSWORD') {
        if (!passwordHash) return false;
        await sql.query('UPDATE users SET password_hash=$1 WHERE id=$2', [passwordHash, active.user_id]);
        await sql.query('UPDATE sessions SET revoked_at=now() WHERE user_id=$1', [active.user_id]);
      } else {
        await sql.query('UPDATE users SET email_verified_at=COALESCE(email_verified_at,now()) WHERE id=$1', [active.user_id]);
      }
      await sql.query('UPDATE account_tokens SET used_at=now() WHERE user_id=$1 AND purpose=$2 AND used_at IS NULL', [active.user_id, purpose]);
      return true;
    });
  }
  async pendingMail() { return (await this.db.query('SELECT id,encrypted_payload FROM mail_outbox WHERE delivered_at IS NULL ORDER BY created_at LIMIT 20')).rows; }
  async delivered(id: string) { await this.db.query('UPDATE mail_outbox SET delivered_at=now() WHERE id=$1', [id]); }
}
