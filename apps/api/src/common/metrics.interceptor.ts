import { CallHandler, ExecutionContext, HttpException, Injectable, NestInterceptor } from '@nestjs/common';
import type { Request, Response } from 'express';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';
import { MetricsService } from './metrics.service';

@Injectable()
export class MetricsInterceptor implements NestInterceptor {
  constructor(private readonly metrics: MetricsService) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    if (context.getType() !== 'http') return next.handle();
    const http = context.switchToHttp();
    const request = http.getRequest<Request>();
    const response = http.getResponse<Response>();
    if (request.path === '/metrics') return next.handle();
    const started = process.hrtime.bigint();
    const method = request.method;
    const route = request.route?.path ?? 'unmatched';
    return next.handle().pipe(
      tap({
        next: () => this.record(method, route, response.statusCode, started),
        error: (error: unknown) => this.record(method, route, error instanceof HttpException ? error.getStatus() : 500, started),
      }),
    );
  }

  private record(method: string, route: string, status: number, started: bigint): void {
    const duration = Number(process.hrtime.bigint() - started) / 1_000_000_000;
    this.metrics.httpRequests.inc({ method, route, status: String(status) });
    this.metrics.httpDuration.observe({ method, route }, duration);
  }
}
