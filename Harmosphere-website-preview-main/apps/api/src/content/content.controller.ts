import { Body, Controller, Get, Inject, Param, Post, Put, Query, Req, UseGuards } from '@nestjs/common';
import { z } from 'zod';
import { ContentService } from './content.service';
import { contentInput, localeInput } from './content.types';
import { AppRequest, BrowserGuard, principal, RateGuard } from '../common/security';
import { AuthGuard } from '../auth/auth.guard';

@Controller('content')
@UseGuards(BrowserGuard, RateGuard)
export class ContentController {
  constructor(@Inject(ContentService) private readonly service: ContentService) {}
  @Get() list(@Query('kind') kind?: string, @Query('locale') locale?: string) { return this.service.list(z.enum(['ARTICLE','RESOURCE']).default('ARTICLE').parse(kind), localeInput.parse(locale)); }
  @Get('entry/:slug') read(@Param('slug') slug: string, @Query('locale') locale?: string) { return this.service.read(z.string().max(100).regex(/^[a-z0-9]+(-[a-z0-9]+)*$/).parse(slug), localeInput.parse(locale)); }
  @Get('editor') @UseGuards(AuthGuard) drafts(@Req() req: AppRequest) { return this.service.drafts(principal(req).userId); }
  @Post('editor') @UseGuards(AuthGuard) create(@Req() req: AppRequest, @Body() body: unknown) { return this.service.create(principal(req).userId, contentInput.parse(body)); }
  @Put('editor/:id') @UseGuards(AuthGuard) update(@Req() req: AppRequest, @Param('id') id: string, @Body() body: unknown) {
    const { revision, entry } = z.object({ revision: z.number().int().nonnegative(), entry: contentInput }).strict().parse(body);
    return this.service.update(principal(req).userId, z.uuid().parse(id), revision, entry);
  }
  @Post('editor/:id/status') @UseGuards(AuthGuard) transition(@Req() req: AppRequest, @Param('id') id: string, @Body() body: unknown) {
    const { revision, status } = z.object({ revision: z.number().int().nonnegative(), status: z.enum(['DRAFT','PUBLISHED']) }).strict().parse(body);
    return this.service.transition(principal(req).userId, z.uuid().parse(id), revision, status);
  }
}
