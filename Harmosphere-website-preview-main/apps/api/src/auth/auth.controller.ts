import { Controller, Post, Get, Body, Req, Res, Inject, UseGuards } from '@nestjs/common';
import { Response } from 'express';
import { z } from 'zod';
import { AuthService } from './auth.service';
import { AuthGuard } from './auth.guard';
import { CONFIG, Config } from '../config';
import { AppRequest, BrowserGuard, RateGuard, getCookie, setCookie, principal } from '../common/security';

const credentials = z.object({ email: z.email().max(254).transform(v => v.trim().toLowerCase()), password: z.string().min(12).max(128) }).strict();
@Controller('auth')
@UseGuards(BrowserGuard, RateGuard)
export class AuthController {
  constructor(@Inject(AuthService) private readonly auth: AuthService, @Inject(CONFIG) private readonly c: Config) {}
  private cookies(res: Response, tokens: { access: string; refresh: string }) {
    setCookie(res, this.c, 'access', tokens.access, 10 * 60_000);
    setCookie(res, this.c, 'refresh', tokens.refresh, 30 * 86400_000);
    return { ok: true };
  }
  @Post('register') async register(@Body() body: unknown, @Res({ passthrough: true }) res: Response) {
    const input = credentials.parse(body);
    return this.cookies(res, await this.auth.register(input.email, input.password));
  }
  @Post('login') async login(@Body() body: unknown, @Res({ passthrough: true }) res: Response) {
    const input = credentials.parse(body);
    return this.cookies(res, await this.auth.login(input.email, input.password));
  }
  @Post('refresh') async refresh(@Req() req: AppRequest, @Res({ passthrough: true }) res: Response) {
    return this.cookies(res, await this.auth.rotate(getCookie(req, this.c, 'refresh') ?? ''));
  }
  @Post('logout') async logout(@Req() req: AppRequest, @Res({ passthrough: true }) res: Response) {
    await this.auth.logout(getCookie(req, this.c, 'refresh') ?? '');
    setCookie(res, this.c, 'access', '', 0); setCookie(res, this.c, 'refresh', '', 0);
    return { ok: true };
  }
  @Get('me') @UseGuards(AuthGuard) me(@Req() req: AppRequest) { return { id: principal(req).userId }; }
}
