import { z } from 'zod';
export const localeInput = z.enum(['en', 'pt-BR', 'es']).default('en');
const translation = z.object({
  title: z.string().trim().min(3).max(140),
  excerpt: z.string().trim().min(10).max(400),
  paragraphs: z.array(z.string().trim().min(1).max(4000)).min(1).max(30),
}).strict();
export const contentInput = z.object({
  slug: z.string().min(3).max(100).regex(/^[a-z0-9]+(-[a-z0-9]+)*$/),
  kind: z.enum(['ARTICLE', 'RESOURCE']),
  category: z.enum(['LISTENING', 'PIANO', 'PRACTICE']),
  translations: z.object({ en: translation, 'pt-BR': translation, es: translation }).strict(),
}).strict();
export type ContentInput = z.infer<typeof contentInput>;
export type ContentRecord = ContentInput & { id: string; status: 'DRAFT' | 'PUBLISHED'; revision: number; published_at: Date | null };
