import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { CONFIG, Config } from './config';
import { QuizRepository } from './quiz/quiz.repository';
import { configureApp } from './bootstrap';
import { NestExpressApplication } from '@nestjs/platform-express';

async function main() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule, { rawBody: true });
  configureApp(app);
  app.enableShutdownHooks();
  await app.get(QuizRepository).seed();
  const c = app.get<Config>(CONFIG);
  // Only the trusted local reverse proxy may reach this listener.
  // Deployment must explicitly configure trusted proxy IPs before scaling.
  await app.listen(c.PORT, '127.0.0.1');
}
main().catch(() => { console.error('API startup failed. Check environment, migrations and database.'); process.exitCode = 1; });
