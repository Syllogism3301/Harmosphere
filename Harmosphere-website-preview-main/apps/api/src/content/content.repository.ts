import { Inject, Injectable } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { DATABASE, Database } from '../database/database';
import { ContentInput, ContentRecord } from './content.types';

@Injectable()
export class ContentRepository {
  constructor(@Inject(DATABASE) private readonly db: Database) {}
  async list(kind: ContentInput['kind']) {
    return (await this.db.query<ContentRecord>("SELECT * FROM content_entries WHERE kind=$1 AND status='PUBLISHED' ORDER BY published_at DESC,id LIMIT 100", [kind])).rows;
  }
  async published(slug: string) {
    return (await this.db.query<ContentRecord>("SELECT * FROM content_entries WHERE slug=$1 AND status='PUBLISHED'", [slug])).rows[0];
  }
  async drafts() { return (await this.db.query<ContentRecord>('SELECT * FROM content_entries ORDER BY updated_at DESC LIMIT 100')).rows; }
  async editor(id: string, email: string) {
    return (await this.db.query('SELECT id FROM users WHERE id=$1 AND email=$2 AND email_verified_at IS NOT NULL', [id, email])).rows.length === 1;
  }
  async create(input: ContentInput) {
    return (await this.db.query<ContentRecord>("INSERT INTO content_entries(id,slug,kind,category,translations) VALUES($1,$2,$3,$4,$5) ON CONFLICT(slug) DO NOTHING RETURNING *", [randomUUID(), input.slug, input.kind, input.category, JSON.stringify(input.translations)])).rows[0];
  }
  async update(id: string, revision: number, input: ContentInput) {
    return (await this.db.query<ContentRecord>(`UPDATE content_entries SET slug=$1,kind=$2,category=$3,translations=$4,revision=revision+1,updated_at=now()
      WHERE id=$5 AND revision=$6 AND status='DRAFT' RETURNING *`, [input.slug, input.kind, input.category, JSON.stringify(input.translations), id, revision])).rows[0];
  }
  async transition(id: string, revision: number, status: 'DRAFT' | 'PUBLISHED') {
    return (await this.db.query<ContentRecord>(`UPDATE content_entries SET status=$1,revision=revision+1,updated_at=now(),published_at=CASE WHEN $1='PUBLISHED' THEN now() ELSE NULL END
      WHERE id=$2 AND revision=$3 RETURNING *`, [status, id, revision])).rows[0];
  }
  async seed(entries: ContentInput[]) {
    for (const entry of entries) {
      await this.db.query("INSERT INTO content_entries(id,slug,kind,category,translations,status,published_at) VALUES($1,$2,$3,$4,$5,'PUBLISHED',now()) ON CONFLICT(slug) DO NOTHING", [randomUUID(), entry.slug, entry.kind, entry.category, JSON.stringify(entry.translations)]);
    }
  }
}
