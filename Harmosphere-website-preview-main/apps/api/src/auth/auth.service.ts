import { Inject, Injectable, ConflictException, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { hashPassword, verifyPassword } from './passwords';
import { AuthRepository } from './auth.repository';
import { CONFIG, Config } from '../config';
import { hash, token, Principal } from '../common/security';

@Injectable()
export class AuthService {
  private readonly jwt = new JwtService();
  constructor(@Inject(AuthRepository) private readonly repo: AuthRepository, @Inject(CONFIG) private readonly c: Config) {}
  async register(email: string, password: string) {
    email = email.trim().toLowerCase();
    const user = await this.repo.createUser(email, await hashPassword(password));
    if (!user) throw new ConflictException('ACCOUNT_UNAVAILABLE');
    return this.issue(user.id, user.password_hash);
  }
  async login(email: string, password: string) {
    email = email.trim().toLowerCase();
    const user = await this.repo.findUser(email);
    if (!await verifyPassword(password, user?.password_hash) || !user) throw new UnauthorizedException('INVALID_CREDENTIALS');
    return this.issue(user.id, user.password_hash);
  }
  private access(userId: string, sessionId: string) {
    return this.jwt.sign({ sub: userId, sid: sessionId }, { secret: this.c.JWT_SECRET, algorithm: 'HS256', expiresIn: '10m', issuer: 'harmosphere-api', audience: 'harmosphere-web' });
  }
  private async issue(userId: string, expectedPasswordHash: string) {
    const refresh = token();
    const sessionId = await this.repo.createSession(userId, hash(refresh), expectedPasswordHash);
    if (!sessionId) throw new UnauthorizedException('CREDENTIALS_CHANGED');
    return { access: this.access(userId, sessionId), refresh };
  }
  async rotate(oldToken: string) {
    const refresh = token();
    const session = await this.repo.rotate(hash(oldToken), hash(refresh));
    if (!session) throw new UnauthorizedException('SESSION_EXPIRED');
    return { access: this.access(session.userId, session.id), refresh };
  }
  async verify(access: string): Promise<Principal> {
    try {
      const p = this.jwt.verify(access, { secret: this.c.JWT_SECRET, algorithms: ['HS256'], issuer: 'harmosphere-api', audience: 'harmosphere-web' });
      if (typeof p.sub !== 'string' || typeof p.sid !== 'string' || !await this.repo.session(p.sid, p.sub)) throw new Error();
      return { userId: p.sub, sessionId: p.sid };
    } catch { throw new UnauthorizedException('SESSION_EXPIRED'); }
  }
  logout(refresh: string) { return this.repo.revoke(hash(refresh)); }
}
