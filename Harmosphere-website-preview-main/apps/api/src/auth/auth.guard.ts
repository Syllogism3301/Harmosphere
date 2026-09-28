import { CanActivate, ExecutionContext, Inject, Injectable } from '@nestjs/common';
import { AuthService } from './auth.service';
import { CONFIG, Config } from '../config';
import { AppRequest, getCookie } from '../common/security';

@Injectable()
export class AuthGuard implements CanActivate {
  constructor(@Inject(AuthService) private readonly auth: AuthService, @Inject(CONFIG) private readonly c: Config) {}
  async canActivate(ctx: ExecutionContext) {
    const req = ctx.switchToHttp().getRequest<AppRequest>();
    req.principal = await this.auth.verify(getCookie(req, this.c, 'access') ?? '');
    return true;
  }
}
