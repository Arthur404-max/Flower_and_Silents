import { ArgumentsHost, Catch, ExceptionFilter, HttpException, Logger } from '@nestjs/common';
import type { Request, Response } from 'express';
import { Prisma } from '@prisma/client';
import type { RequestWithId } from './request-context';

@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger('HttpException');

  catch(exception: unknown, host: ArgumentsHost): void {
    const context = host.switchToHttp();
    const response = context.getResponse<Response>();
    const request = context.getRequest<RequestWithId>();
    if (response.headersSent) return;

    let status = 500;
    let title = 'Внутренняя ошибка';
    let detail = 'Не удалось выполнить запрос. Попробуйте ещё раз.';

    if (exception instanceof HttpException) {
      status = exception.getStatus();
      const body = exception.getResponse();
      title = status === 400 ? 'Некорректный запрос' : exception.message;
      if (typeof body === 'string') detail = body;
      else if (typeof body === 'object' && body !== null) {
        const value = body as Record<string, unknown>;
        if (Array.isArray(value.message)) detail = value.message.join('; ');
        else if (typeof value.message === 'string') detail = value.message;
        else if (typeof value.detail === 'string') detail = value.detail;
        else if (typeof value.title === 'string') title = value.title;
      }
    } else if (exception instanceof Prisma.PrismaClientKnownRequestError) {
      if (exception.code === 'P2002') {
        status = 409;
        title = 'Конфликт данных';
        detail = 'Такая запись уже существует';
      } else if (exception.code === 'P2025') {
        status = 404;
        title = 'Не найдено';
        detail = 'Запрошенная запись не существует';
      }
    }

    if (status >= 500) {
      this.logger.error(JSON.stringify({
        requestId: request.requestId,
        error: exception instanceof Error ? exception.name : 'UnknownError',
      }));
    }

    response.status(status).json({
      type: `urn:cvetotishina:problem:${status}`,
      title,
      status,
      detail,
      requestId: request.requestId,
    });
  }
}
