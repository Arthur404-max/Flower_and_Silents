import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import type { Request } from 'express';
import { AppConfigService } from './app-config.service';

@Injectable()
export class OriginGuard implements CanActivate {
  constructor(private readonly config: AppConfigService) {}

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<Request>();
    if (!['POST', 'PUT', 'PATCH', 'DELETE'].includes(request.method)) return true;
    const origin = request.header('origin');
    const fetchSite = request.header('sec-fetch-site');
    if (fetchSite === 'cross-site') throw new ForbiddenException('Междоменные запросы запрещены');
    if (origin && !this.config.allowedOrigins.includes(origin)) throw new ForbiddenException('Источник запроса не разрешён');
    return true;
  }
}
