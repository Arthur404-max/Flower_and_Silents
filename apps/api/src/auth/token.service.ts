import { Injectable, UnauthorizedException } from '@nestjs/common';
import { randomBytes } from 'node:crypto';
import { SignJWT, jwtVerify } from 'jose';
import { AppConfigService } from '../common/app-config.service';

export interface AdminIdentity {
  id: string;
  email: string;
  name: string;
}

@Injectable()
export class TokenService {
  private readonly secret: Uint8Array;

  constructor(private readonly config: AppConfigService) {
    this.secret = new TextEncoder().encode(config.jwtSecret);
  }

  async signAccess(user: AdminIdentity): Promise<string> {
    return new SignJWT({ email: user.email, name: user.name, type: 'admin' })
      .setProtectedHeader({ alg: 'HS256', typ: 'JWT' })
      .setSubject(user.id)
      .setIssuer('cvetotishina')
      .setAudience('admin')
      .setIssuedAt()
      .setExpirationTime('15m')
      .sign(this.secret);
  }

  async verifyAccess(token: string): Promise<AdminIdentity> {
    try {
      const { payload } = await jwtVerify(token, this.secret, {
        issuer: 'cvetotishina',
        audience: 'admin',
        algorithms: ['HS256'],
      });
      if (payload.type !== 'admin' || !payload.sub || typeof payload.email !== 'string' || typeof payload.name !== 'string') {
        throw new Error('Invalid token payload');
      }
      return { id: payload.sub, email: payload.email, name: payload.name };
    } catch {
      throw new UnauthorizedException('Требуется вход администратора');
    }
  }

  createRefreshToken(): string {
    return randomBytes(32).toString('base64url');
  }

  createCsrfToken(): string {
    return randomBytes(32).toString('base64url');
  }
}
