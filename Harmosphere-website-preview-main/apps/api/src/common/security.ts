import { CanActivate, ExecutionContext, Injectable, Inject, ForbiddenException, HttpException, UnauthorizedException } from '@nestjs/common';
import { Request, Response } from 'express';
import { createHash, randomBytes } from 'node:crypto';
import { CONFIG, Config } from '../config';
import { DATABASE, Database } from '../database/database';

export const hash = (s: string) => createHash('sha256').update(s).digest('hex');
export const token = () => randomBytes(32).toString('base64url');
export type Principal = { userId: string; sessionId: string };
export type AppRequest = Request & { principal?: Principal };
export function principal(req: AppRequest) { if (!req.principal) throw new UnauthorizedException(); return req.principal; }
export function cookieName(c: Config, name: string) { return `${c.NODE_ENV === 'production' ? '__Host-' : ''}hs_${name}`; }
export function setCookie(res: Response, c: Config, name: string, value: string, maxAge: number) {
  res.cookie(cookieName(c, name), value, { httpOnly: true, secure: c.NODE_ENV === 'production', sameSite: 'lax', path: '/', maxAge });
}
export function getCookie(req: Request, c: Config, name: string): string | undefined {
  const value = req.cookies?.[cookieName(c, name)];
  return typeof value === 'string' && value.length <= 2048 ? value : undefined;
}

@Injectable()
export class BrowserGuard implements CanActivate {
  constructor(@Inject(CONFIG) private readonly c: Config) {}
  canActivate(ctx: ExecutionContext) {
    const req = ctx.switchToHttp().getRequest<Request>();
    if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) return true;
    // Webhooks do not use this guard; their controllers verify provider signatures.
    if (req.get('origin') !== this.c.WEB_ORIGIN || req.get('x-harmosphere') !== '1' || !req.is('application/json')) {
      throw new ForbiddenException('INVALID_ORIGIN');
    }
    return true;
  }
}

@Injectable()
export class RateGuard implements CanActivate {
  constructor(@Inject(DATABASE) private readonly db: Database) {}
  async canActivate(ctx: ExecutionContext) {
    const req = ctx.switchToHttp().getRequest<Request>();
    const sensitive = (req.path.includes('/auth/') && req.method !== 'GET') || (req.path.endsWith('/attempts') && req.method === 'POST');
    const limit = sensitive ? 15 : 180;
    const key = hash(`${req.ip}:${sensitive ? 'sensitive' : 'general'}`);
    const { rows } = await this.db.query(`INSERT INTO rate_limits(key,count,expires_at) VALUES($1,1,now()+interval '1 minute')
      ON CONFLICT(key) DO UPDATE SET count=CASE WHEN rate_limits.expires_at<now() THEN 1 ELSE rate_limits.count+1 END,
      expires_at=CASE WHEN rate_limits.expires_at<now() THEN now()+interval '1 minute' ELSE rate_limits.expires_at END RETURNING count`, [key]);
    if (rows[0].count > limit) throw new HttpException('RATE_LIMITED', 429);
    return true;
  }
}
