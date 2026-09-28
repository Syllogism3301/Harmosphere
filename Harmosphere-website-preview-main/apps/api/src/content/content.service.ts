import { ConflictException, ForbiddenException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { ContentRepository } from './content.repository';
import { CONFIG, Config } from '../config';
import { Locale } from '../quiz/definition';
import { ContentInput, ContentRecord } from './content.types';

@Injectable()
export class ContentService {
  constructor(@Inject(ContentRepository) private readonly repo: ContentRepository, @Inject(CONFIG) private readonly c: Config) {}
  private localize(entry: ContentRecord, locale: Locale, body = false) {
    const copy = entry.translations[locale];
    return { id: entry.id, slug: entry.slug, kind: entry.kind, category: entry.category, title: copy.title, excerpt: copy.excerpt,
      publishedAt: entry.published_at, ...(body ? { paragraphs: copy.paragraphs } : {}) };
  }
  async list(kind: ContentInput['kind'], locale: Locale) { return (await this.repo.list(kind)).map(e => this.localize(e, locale)); }
  async read(slug: string, locale: Locale) {
    const entry = await this.repo.published(slug);
    if (!entry) throw new NotFoundException('CONTENT_NOT_FOUND');
    return this.localize(entry, locale, true);
  }
  async authorizeEditor(userId: string) {
    if (this.c.NODE_ENV === 'production' || !this.c.LOCAL_EDITOR_EMAIL || !await this.repo.editor(userId, this.c.LOCAL_EDITOR_EMAIL)) throw new ForbiddenException('EDITOR_REQUIRED');
  }
  async drafts(userId: string) { await this.authorizeEditor(userId); return this.repo.drafts(); }
  async create(userId: string, input: ContentInput) {
    await this.authorizeEditor(userId);
    const row = await this.repo.create(input); if (!row) throw new ConflictException('SLUG_ALREADY_EXISTS'); return row;
  }
  async update(userId: string, id: string, revision: number, input: ContentInput) {
    await this.authorizeEditor(userId);
    try {
      const row = await this.repo.update(id, revision, input);
      if (!row) throw new ConflictException('DRAFT_OR_REVISION_REQUIRED'); return row;
    } catch (e: any) { if (e.code === '23505') throw new ConflictException('SLUG_ALREADY_EXISTS'); throw e; }
  }
  async transition(userId: string, id: string, revision: number, status: 'DRAFT' | 'PUBLISHED') {
    await this.authorizeEditor(userId);
    const row = await this.repo.transition(id, revision, status);
    if (!row) throw new ConflictException('STALE_REVISION'); return row;
  }
}
