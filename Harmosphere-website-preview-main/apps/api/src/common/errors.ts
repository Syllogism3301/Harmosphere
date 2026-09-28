import { ArgumentsHost, Catch, ExceptionFilter, HttpException, Logger } from '@nestjs/common';
import { ZodError } from 'zod';
import { randomUUID } from 'node:crypto';

@Catch()
export class ErrorFilter implements ExceptionFilter {
  private readonly logger = new Logger('API');
  catch(error: unknown, host: ArgumentsHost) {
    const id = randomUUID();
    const status = error instanceof ZodError ? 400 : error instanceof HttpException ? error.getStatus() : 500;
    const code = error instanceof ZodError ? 'INVALID_INPUT' : error instanceof HttpException ? error.message : 'INTERNAL_ERROR';
    if (status >= 500) this.logger.error({ requestId: id, code: 'INTERNAL_ERROR', errorType: error instanceof Error ? error.name : 'Unknown' });
    host.switchToHttp().getResponse().status(status).json({ code, requestId: id });
  }
}
