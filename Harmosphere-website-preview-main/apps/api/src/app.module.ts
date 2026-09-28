import { Module } from '@nestjs/common';
import { CONFIG, readConfig } from './config';
import { DATABASE, PostgresDatabase } from './database/database';
import { BrowserGuard, RateGuard } from './common/security';
import { AuthController } from './auth/auth.controller';
import { AuthRepository } from './auth/auth.repository';
import { AuthService } from './auth/auth.service';
import { AuthGuard } from './auth/auth.guard';
import { QuizController } from './quiz/quiz.controller';
import { QuizRepository } from './quiz/quiz.repository';
import { QuizService } from './quiz/quiz.service';
import { PaymentsController, WebhooksController } from './payments/payments.controller';
import { PaymentsRepository } from './payments/payments.repository';
import { PaymentsService } from './payments/payments.service';
import { StripeAdapter, MercadoPagoAdapter } from './payments/adapters';
import { AccountRepository } from './auth/account.repository';
import { AccountService } from './auth/account.service';
import { AccountController } from './auth/account.controller';
import { ContentRepository } from './content/content.repository';
import { ContentService } from './content/content.service';
import { ContentController } from './content/content.controller';

export const providers = [BrowserGuard, RateGuard, AuthGuard, AuthRepository, AuthService, AccountRepository, AccountService, ContentRepository, ContentService, QuizRepository, QuizService, PaymentsRepository, PaymentsService, StripeAdapter, MercadoPagoAdapter];
export const controllers = [AuthController, AccountController, ContentController, QuizController, PaymentsController, WebhooksController];
@Module({ controllers, providers: [{ provide: CONFIG, useFactory: readConfig }, { provide: DATABASE, useClass: PostgresDatabase }, ...providers] })
export class AppModule {}
