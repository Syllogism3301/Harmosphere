import { Controller, Post, Get, Req, Body, Headers, Query, Inject, UseGuards, HttpCode, RawBodyRequest, BadRequestException } from '@nestjs/common';
import { Request } from 'express';
import { z } from 'zod';
import { PaymentsService } from './payments.service';
import { AuthGuard } from '../auth/auth.guard';
import { BrowserGuard, RateGuard, AppRequest, principal } from '../common/security';
import { locales } from '../quiz/definition';

@Controller('payments')
@UseGuards(BrowserGuard, RateGuard)
export class PaymentsController {
  constructor(@Inject(PaymentsService) private readonly payments: PaymentsService) {}
  @Get('offers') offers() { return this.payments.offers(); }
  @Post('checkout') @UseGuards(AuthGuard) checkout(@Req() req: AppRequest, @Body() body: unknown) {
    const input = z.object({ attemptId: z.uuid(), provider: z.enum(['stripe', 'mercadopago']), locale: z.enum(locales) }).strict().parse(body);
    return this.payments.checkout(principal(req).userId, input.attemptId, input.provider, input.locale);
  }
}
@Controller('payments/webhooks')
export class WebhooksController {
  constructor(@Inject(PaymentsService) private readonly payments: PaymentsService) {}
  @Post('stripe') @HttpCode(200) stripe(@Req() req: RawBodyRequest<Request>, @Headers('stripe-signature') signature?: string) {
    if (!req.rawBody || typeof signature !== 'string') throw new BadRequestException('INVALID_SIGNATURE');
    return this.payments.stripeWebhook(req.rawBody, signature);
  }
  @Post('mercadopago') @HttpCode(200) mercado(@Headers('x-signature') signature?: string, @Headers('x-request-id') requestId?: string, @Query('data.id') id?: string) {
    if (typeof signature !== 'string' || typeof requestId !== 'string' || typeof id !== 'string') throw new BadRequestException('INVALID_SIGNATURE');
    return this.payments.mercadoWebhook(signature, requestId, id);
  }
}
