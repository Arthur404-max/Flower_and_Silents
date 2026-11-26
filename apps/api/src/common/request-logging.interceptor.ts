import { CallHandler, ExecutionContext, HttpException, Injectable, NestInterceptor } from '@nestjs/common';
import type { Request, Response } from 'express';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';
import type { RequestWithId } from './request-context';

@Injectable()
export class RequestLoggingInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    if (context.getType() !== 'http') return next.handle();
    const http = context.switchToHttp();
    const request = http.getRequest<RequestWithId>();
    const response = http.getResponse<Response>();
    if (request.path === '/metrics') return next.handle();
    const started = process.hrtime.bigint();
    return next.handle().pipe(
      tap({
        next: () => this.log(request, response.statusCode, started),
        error: (error: unknown) => {
          this.log(request, error instanceof HttpException ? error.getStatus() : 500, started);
          console.error(JSON.stringify({ level: 'error', requestId: request.requestId, error: this.errorName(error) }));
        },
      }),
    );
  }

  private log(request: RequestWithId, status: number, started: bigint): void {
    console.log(JSON.stringify({
      level: 'info',
      requestId: request.requestId,
      method: request.method,
      route: request.route?.path ?? 'unmatched',
      status,
      durationMs: Math.round(Number(process.hrtime.bigint() - started) / 1_000_000),
    }));
  }

  private errorName(error: unknown): string {
    return error instanceof Error ? error.name : 'UnknownError';
  }
}
