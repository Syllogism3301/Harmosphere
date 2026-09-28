import { Body, Controller, Get, Inject, Post, Req, UseGuards } from '@nestjs/common';
import { z } from 'zod';
import { AccountService } from './account.service';
import { AuthGuard } from './auth.guard';
import { AppRequest, BrowserGuard, principal, RateGuard } from '../common/security';
import { locales } from '../quiz/definition';
const tokenSchema = z.string().regex(/^[A-Za-z0-9_-]{43}$/);
@Controller('auth/account')
@UseGuards(BrowserGuard, RateGuard)
export class AccountController {
  constructor(@Inject(AccountService) private readonly service: AccountService) {}
  @Get() @UseGuards(AuthGuard) profile(@Req() req: AppRequest) { return this.service.profile(principal(req).userId); }
  @Post('forgot-password') forgot(@Body() body: unknown) {
    const input = z.object({ email: z.email().max(254), locale: z.enum(locales) }).strict().parse(body);
    return this.service.requestReset(input.email, input.locale);
  }
  @Post('reset-password') reset(@Body() body: unknown) {
    const input = z.object({ token: tokenSchema, password: z.string().min(12).max(128) }).strict().parse(body);
    return this.service.reset(input.token, input.password);
  }
  @Post('request-verification') @UseGuards(AuthGuard) requestVerification(@Req() req: AppRequest, @Body() body: unknown) {
    return this.service.requestVerification(principal(req).userId, z.object({ locale: z.enum(locales) }).strict().parse(body).locale);
  }
  @Post('verify-email') verify(@Body() body: unknown) { return this.service.verify(z.object({ token: tokenSchema }).strict().parse(body).token); }
}
