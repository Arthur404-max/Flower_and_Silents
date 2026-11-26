import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { timingSafeEqual } from 'node:crypto';
import type { Request } from 'express';

@Injectable()
export class AdminMutationGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<Request>();
    if (['GET', 'HEAD', 'OPTIONS'].includes(request.method)) return true;
    const cookieToken = request.cookies?.ct_csrf;
    const headerToken = request.header('x-csrf-token');
    if (!cookieToken || !headerToken || cookieToken.length !== headerToken.length) {
      throw new ForbiddenException('Требуется проверка CSRF');
    }
    if (!timingSafeEqual(Buffer.from(cookieToken), Buffer.from(headerToken))) {
      throw new ForbiddenException('Неверный CSRF-токен');
    }
    return true;
  }
}
