import { Global, Module } from '@nestjs/common';
import { APP_INTERCEPTOR } from '@nestjs/core';
import { AppConfigService } from './app-config.service';
import { PrismaService } from './prisma.service';
import { MetricsService } from './metrics.service';
import { RedisService } from './redis.service';
import { MetricsInterceptor } from './metrics.interceptor';
import { RequestLoggingInterceptor } from './request-logging.interceptor';
import { MetricsController } from './metrics.controller';
import { HealthController } from './health.controller';

@Global()
@Module({
  providers: [
    AppConfigService,
    PrismaService,
    MetricsService,
    RedisService,
    { provide: APP_INTERCEPTOR, useClass: MetricsInterceptor },
    { provide: APP_INTERCEPTOR, useClass: RequestLoggingInterceptor },
  ],
  controllers: [MetricsController, HealthController],
  exports: [AppConfigService, PrismaService, MetricsService, RedisService],
})
export class CommonModule {}
