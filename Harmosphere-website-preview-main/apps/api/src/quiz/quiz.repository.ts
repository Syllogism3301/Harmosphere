import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { DATABASE, Database, Sql } from '../database/database';
import { definition } from './definition';
import { scoreQuiz } from './scoring';

@Injectable()
export class QuizRepository {
  constructor(@Inject(DATABASE) readonly db: Database) {}
  async seed() { await this.db.query('INSERT INTO quiz_versions(id,definition) VALUES($1,$2) ON CONFLICT(id) DO NOTHING', [definition.id, JSON.stringify(definition)]); }
  async create(id: string, anonymousHash: string) {
    return (await this.db.query("INSERT INTO attempts(id,version_id,anonymous_hash,anonymous_expires_at) VALUES($1,$2,$3,now()+interval '30 days') RETURNING id", [id, definition.id, anonymousHash])).rows[0];
  }
  async anonymous(anonymousHash: string, sql: Sql = this.db, lock = false) {
    return (await sql.query(`SELECT a.*,v.definition FROM attempts a JOIN quiz_versions v ON v.id=a.version_id WHERE a.anonymous_hash=$1 AND a.user_id IS NULL AND a.anonymous_expires_at>now() ${lock ? 'FOR UPDATE OF a' : ''}`, [anonymousHash])).rows[0];
  }
  withAnonymous<T>(anonymousHash: string, work: (attempt: any, mutations: {
    saveAnswers(answers: Record<string, number>): Promise<void>;
    finish(result: ReturnType<typeof scoreQuiz>): Promise<void>;
    claim(userId: string): Promise<void>;
  }) => Promise<T>) {
    return this.db.transaction(async sql => {
      const a = await this.anonymous(anonymousHash, sql, true);
      if (!a) throw new NotFoundException('ATTEMPT_NOT_FOUND');
      return work(a, {
        saveAnswers: async answers => { await sql.query('UPDATE attempts SET answers=$1,revision=revision+1 WHERE id=$2', [JSON.stringify(answers), a.id]); },
        finish: async result => { await sql.query("UPDATE attempts SET status='COMPLETED',completed_at=now(),result=$1 WHERE id=$2", [JSON.stringify(result), a.id]); },
        claim: async userId => { await sql.query('UPDATE attempts SET user_id=$1,anonymous_hash=NULL WHERE id=$2', [userId, a.id]); },
      });
    });
  }
  async owned(id: string, userId: string) { return (await this.db.query('SELECT id,status,result FROM attempts WHERE id=$1 AND user_id=$2', [id, userId])).rows[0]; }
  async full(id: string, userId: string) {
    return (await this.db.query(`SELECT a.result FROM attempts a JOIN entitlements e ON e.attempt_id=a.id JOIN orders o ON o.id=e.order_id
      WHERE a.id=$1 AND a.user_id=$2 AND a.status='COMPLETED' AND e.user_id=$2 AND e.revoked_at IS NULL AND o.user_id=$2 AND o.status='PAID'`, [id, userId])).rows[0];
  }
  async list(userId: string) { return (await this.db.query(`SELECT a.id,a.created_at,a.status,a.result->'title' AS title, EXISTS(SELECT 1 FROM entitlements e JOIN orders o ON o.id=e.order_id WHERE e.attempt_id=a.id AND e.user_id=$1 AND e.revoked_at IS NULL AND o.status='PAID') AS unlocked FROM attempts a WHERE a.user_id=$1 ORDER BY a.created_at DESC LIMIT 100`, [userId])).rows; }
}
