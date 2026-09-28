import { Inject, Injectable } from '@nestjs/common';
import { DATABASE, Database } from '../database/database';
import { randomUUID } from 'node:crypto';

@Injectable()
export class AuthRepository {
  constructor(@Inject(DATABASE) private readonly db: Database) {}
  async createUser(email: string, passwordHash: string) {
    const result = await this.db.query('INSERT INTO users(id,email,password_hash) VALUES($1,$2,$3) ON CONFLICT(email) DO NOTHING RETURNING id,email,password_hash', [randomUUID(), email, passwordHash]);
    return result.rows[0];
  }
  async findUser(email: string) { return (await this.db.query('SELECT id,email,password_hash FROM users WHERE email=$1', [email])).rows[0]; }
  async session(id: string, userId: string) { return (await this.db.query('SELECT id FROM sessions WHERE id=$1 AND user_id=$2 AND revoked_at IS NULL AND expires_at>now()', [id, userId])).rows[0]; }
  async createSession(userId: string, refreshHash: string, expectedPasswordHash?: string) {
    return this.db.transaction(async sql => {
      const user = (await sql.query('SELECT password_hash FROM users WHERE id=$1 FOR SHARE', [userId])).rows[0];
      if (!user || (expectedPasswordHash && user.password_hash !== expectedPasswordHash)) return null;
      const id = randomUUID();
      await sql.query("INSERT INTO sessions(id,user_id,refresh_hash,expires_at) VALUES($1,$2,$3,now()+interval '30 days')", [id, userId, refreshHash]);
      return id;
    });
  }
  async rotate(oldHash: string, newHash: string) {
    return this.db.transaction(async sql => {
      // Retain spent hashes until session expiration to detect refresh replay.
      const used = (await sql.query('SELECT session_id FROM used_refresh_tokens WHERE token_hash=$1', [oldHash])).rows[0];
      if (used) { await sql.query('UPDATE sessions SET revoked_at=now() WHERE id=$1', [used.session_id]); return null; }
      const current = (await sql.query('SELECT * FROM sessions WHERE refresh_hash=$1 FOR UPDATE', [oldHash])).rows[0];
      if (!current) {
        // A concurrent rotation can move the token after our first lookup.
        await sql.query('UPDATE sessions SET revoked_at=now() WHERE id IN (SELECT session_id FROM used_refresh_tokens WHERE token_hash=$1)', [oldHash]);
        return null;
      }
      if (current.revoked_at || new Date(current.expires_at).getTime() <= Date.now()) return null;
      await sql.query('INSERT INTO used_refresh_tokens(token_hash,session_id,expires_at) VALUES($1,$2,$3)', [oldHash, current.id, current.expires_at]);
      await sql.query('UPDATE sessions SET refresh_hash=$1 WHERE id=$2', [newHash, current.id]);
      return { id: current.id as string, userId: current.user_id as string };
    });
  }
  async revoke(refreshHash: string) {
    await this.db.query('UPDATE sessions SET revoked_at=now() WHERE refresh_hash=$1 OR id IN (SELECT session_id FROM used_refresh_tokens WHERE token_hash=$1)', [refreshHash]);
  }
}
