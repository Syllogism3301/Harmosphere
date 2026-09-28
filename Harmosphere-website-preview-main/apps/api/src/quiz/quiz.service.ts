import { Inject, Injectable, NotFoundException, ConflictException, BadRequestException } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { QuizRepository } from './quiz.repository';
import { hash, token } from '../common/security';
import { Definition, Locale } from './definition';
import { scoreQuiz } from './scoring';

@Injectable()
export class QuizService {
  constructor(@Inject(QuizRepository) private readonly repo: QuizRepository) {}
  async start(existing?: string) {
    if (existing) { const current = await this.repo.anonymous(hash(existing)); if (current) return { id: current.id, token: existing }; }
    const anonymous = token(); const id = randomUUID();
    await this.repo.create(id, hash(anonymous));
    return { id, token: anonymous };
  }
  async current(anonymous: string, locale: Locale) {
    const a = await this.repo.anonymous(hash(anonymous));
    if (!a) throw new NotFoundException('ATTEMPT_NOT_FOUND');
    const def = a.definition as Definition;
    return { id: a.id, status: a.status, revision: a.revision, answers: a.answers, questions: def.questions.map(q => ({ id: q.id, text: q.text[locale] })) };
  }
  async answer(anonymous: string, questionId: string, value: number, revision: number) {
    return this.repo.withAnonymous(hash(anonymous), async (a, mutations) => {
      if (a.status !== 'IN_PROGRESS') throw new ConflictException('ATTEMPT_COMPLETED');
      if (a.revision !== revision) throw new ConflictException('STALE_REVISION');
      if (!(a.definition as Definition).questions.some(q => q.id === questionId)) throw new BadRequestException('INVALID_QUESTION');
      const answers = { ...a.answers, [questionId]: value };
      await mutations.saveAnswers(answers);
      return { revision: revision + 1, answers };
    });
  }
  async complete(anonymous: string) {
    return this.repo.withAnonymous(hash(anonymous), async (a, mutations) => {
      if (a.status !== 'COMPLETED') {
        const result = scoreQuiz(a.definition, a.answers);
        await mutations.finish(result);
      }
      return { id: a.id, requiresLogin: true };
    });
  }
  async claim(anonymous: string, userId: string) {
    return this.repo.withAnonymous(hash(anonymous), async (a, mutations) => {
      if (a.status !== 'COMPLETED') throw new ConflictException('QUIZ_INCOMPLETE');
      await mutations.claim(userId);
      return { id: a.id };
    });
  }
  async preview(id: string, userId: string, locale: Locale) {
    const a = await this.repo.owned(id, userId);
    if (!a || a.status !== 'COMPLETED') throw new NotFoundException('RESULT_NOT_FOUND');
    return { title: a.result.title[locale], summary: a.result.summary[locale] };
  }
  async full(id: string, userId: string, locale: Locale) {
    const a = await this.repo.full(id, userId);
    if (!a) throw new NotFoundException('RESULT_LOCKED');
    return { title: a.result.title[locale], summary: a.result.summary[locale], exercise: a.result.exercise[locale], scores: a.result.scores };
  }
  list(userId: string) { return this.repo.list(userId); }
}
