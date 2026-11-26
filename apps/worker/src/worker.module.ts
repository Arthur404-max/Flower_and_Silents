import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { resolve } from 'node:path';
import { EventProcessor } from './event.processor';
import { HealthController } from './health.controller';
import { MetricsService } from './metrics.service';
import { OrderCleanup } from './order-cleanup';
import { OutboxPoller } from './outbox.poller';
import { PrismaService } from './prisma.service';
import { QueueService } from './queue.service';
import { WorkerConfigService } from './worker-config.service';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: [resolve(process.cwd(), '../../.env'), resolve(process.cwd(), '.env')],
    }),
  ],
  controllers: [HealthController],
  providers: [WorkerConfigService, PrismaService, MetricsService, QueueService, OutboxPoller, EventProcessor, OrderCleanup],
})
export class WorkerModule {}
