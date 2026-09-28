import { Body, Controller, Get, Post, Put, Param, Query, Req, Res, Inject, UseGuards } from '@nestjs/common';
import { Response } from 'express';
import { z } from 'zod';
import { QuizService } from './quiz.service';
import { locales } from './definition';
import { CONFIG, Config } from '../config';
import { AppRequest, BrowserGuard, RateGuard, getCookie, setCookie, principal } from '../common/security';
import { AuthGuard } from '../auth/auth.guard';

const localeSchema = z.enum(locales).default('en');
const answerSchema = z.object({ questionId: z.string().regex(/^q[1-9][0-9]?$/), value: z.number().int().min(1).max(5), revision: z.number().int().nonnegative() }).strict();
@Controller('quiz')
@UseGuards(BrowserGuard, RateGuard)
export class QuizController {
  constructor(@Inject(QuizService) private readonly quiz: QuizService, @Inject(CONFIG) private readonly c: Config) {}
  @Post('attempts') async start(@Req() req: AppRequest, @Res({ passthrough: true }) res: Response) {
    const result = await this.quiz.start(getCookie(req, this.c, 'anonymous'));
    setCookie(res, this.c, 'anonymous', result.token, 30 * 86400_000);
    return { id: result.id };
  }
  @Get('current') current(@Req() req: AppRequest, @Query('locale') locale?: string) { return this.quiz.current(getCookie(req, this.c, 'anonymous') ?? '', localeSchema.parse(locale)); }
  @Put('current/answer') answer(@Req() req: AppRequest, @Body() body: unknown) {
    const a = answerSchema.parse(body);
    return this.quiz.answer(getCookie(req, this.c, 'anonymous') ?? '', a.questionId, a.value, a.revision);
  }
  @Post('current/complete') complete(@Req() req: AppRequest) { return this.quiz.complete(getCookie(req, this.c, 'anonymous') ?? ''); }
  @Post('current/claim') @UseGuards(AuthGuard) async claim(@Req() req: AppRequest, @Res({ passthrough: true }) res: Response) {
    const result = await this.quiz.claim(getCookie(req, this.c, 'anonymous') ?? '', principal(req).userId);
    setCookie(res, this.c, 'anonymous', '', 0);
    return result;
  }
  @Get('results') @UseGuards(AuthGuard) list(@Req() req: AppRequest) { return this.quiz.list(principal(req).userId); }
  @Get('results/:id/preview') @UseGuards(AuthGuard) preview(@Req() req: AppRequest, @Param('id') id: string, @Query('locale') locale?: string) { return this.quiz.preview(z.uuid().parse(id), principal(req).userId, localeSchema.parse(locale)); }
  @Get('results/:id/full') @UseGuards(AuthGuard) full(@Req() req: AppRequest, @Param('id') id: string, @Query('locale') locale?: string) { return this.quiz.full(z.uuid().parse(id), principal(req).userId, localeSchema.parse(locale)); }
}
