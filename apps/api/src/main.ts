import 'reflect-metadata';
import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import type { NestExpressApplication } from '@nestjs/platform-express';
import cookieParser from 'cookie-parser';
import type { NextFunction, Response } from 'express';
import { AppModule } from './app.module';
import { AppConfigService } from './common/app-config.service';
import { AllExceptionsFilter } from './common/all-exceptions.filter';
import { OriginGuard } from './common/origin.guard';
import { requestIdMiddleware } from './common/request-context';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create<NestExpressApplication>(AppModule, { bufferLogs: true });
  const config = app.get(AppConfigService);
  app.disable('x-powered-by');
  app.use((_request: unknown, response: Response, next: NextFunction) => {
    response.setHeader('X-Content-Type-Options', 'nosniff');
    response.setHeader('X-Frame-Options', 'DENY');
    response.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
    response.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
    next();
  });
  app.use(cookieParser());
  app.use(requestIdMiddleware);
  app.useStaticAssets(config.uploadDir, { prefix: '/uploads/' });
  app.useGlobalGuards(new OriginGuard(config));
  app.useGlobalPipes(new ValidationPipe({
    whitelist: true,
    forbidNonWhitelisted: true,
    transform: true,
    transformOptions: { enableImplicitConversion: true },
  }));
  app.useGlobalFilters(new AllExceptionsFilter());
  app.enableShutdownHooks();
  await app.listen(config.apiPort, '0.0.0.0');
  console.log(JSON.stringify({ level: 'info', message: 'API запущен', port: config.apiPort }));
}

bootstrap().catch((error: unknown) => {
  console.error(JSON.stringify({ level: 'error', message: error instanceof Error ? error.message : 'Ошибка запуска API' }));
  process.exitCode = 1;
});
