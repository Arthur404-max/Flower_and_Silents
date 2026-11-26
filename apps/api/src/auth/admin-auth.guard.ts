import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import type { Request } from 'express';
import { PrismaService } from '../common/prisma.service';
import { TokenService, type AdminIdentity } from './token.service';

export interface AdminRequest extends Request {
  admin: AdminIdentity;
}

@Injectable()
export class AdminAuthGuard implements CanActivate {
  constructor(
    private readonly tokens: TokenService,
    private readonly prisma: PrismaService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<Request>();
    const token = request.cookies?.ct_access;
    if (!token) throw new UnauthorizedException('Требуется вход администратора');
    const identity = await this.tokens.verifyAccess(token);
    const user = await this.prisma.adminUser.findFirst({ where: { id: identity.id, isActive: true } });
    if (!user) throw new UnauthorizedException('Учётная запись недоступна');
    (request as AdminRequest).admin = { id: user.id, email: user.email, name: user.name };
    return true;
  }
}
