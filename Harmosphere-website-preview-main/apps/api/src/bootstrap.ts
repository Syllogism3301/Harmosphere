import { NestExpressApplication } from '@nestjs/platform-express';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import { ErrorFilter } from './common/errors';
import { Request, Response, NextFunction } from 'express';

export function configureApp(app: NestExpressApplication) {
  app.setGlobalPrefix('api');
  // Do not trust client-supplied forwarding headers. Production ingress must
  // strip them and configure explicit proxy trust before per-client scaling.
  app.set('trust proxy', false);
  app.useBodyParser('json', { limit: '128kb' });
  app.use(helmet()); app.use(cookieParser());
  app.use((_req: Request, res: Response, next: NextFunction) => { res.setHeader('Cache-Control', 'private, no-store'); next(); });
  app.useGlobalFilters(new ErrorFilter());
}
