import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { Worker, type Job } from 'bullmq';
import { Prisma } from '@prisma/client';
import IORedis from 'ioredis';
import { MetricsService } from './metrics.service';
import { PrismaService } from './prisma.service';
import { QueueService, type EventJobData } from './queue.service';
import { WorkerConfigService } from './worker-config.service';

@Injectable()
export class EventProcessor implements OnModuleInit, OnModuleDestroy {
  private worker: Worker<EventJobData> | undefined;
  private readonly connection: IORedis;

  constructor(
    private readonly queue: QueueService,
    private readonly prisma: PrismaService,
    private readonly metrics: MetricsService,
    config: WorkerConfigService,
  ) {
    this.connection = new IORedis(config.redisUrl, { maxRetriesPerRequest: null });
  }

  onModuleInit(): void {
    this.worker = new Worker<EventJobData>('order-events', (job) => this.process(job), {
      connection: this.connection,
      concurrency: 5,
      limiter: { max: 20, duration: 1_000 },
    });
    this.worker.on('failed', (job, error) => {
      this.metrics.eventsFailed.inc();
      console.error(JSON.stringify({ level: 'error', component: 'events', jobId: job?.id, error: error.name }));
      if (job && job.attemptsMade >= 5) void this.queue.deadLetter(job).catch(() => undefined);
    });
    this.worker.on('error', (error) => {
      console.error(JSON.stringify({ level: 'error', component: 'worker', error: error.name }));
    });
  }

  async onModuleDestroy(): Promise<void> {
    await this.worker?.close();
    this.connection.disconnect();
  }

  private async process(job: Job<EventJobData>): Promise<void> {
    const stopTimer = this.metrics.jobDuration.startTimer();
    try {
      const order = await this.prisma.order.findUnique({
        where: { id: job.data.aggregateId },
        select: { number: true, phone: true, email: true, status: true, total: true },
      });
      if (order) {
        const recipient = order.email ?? order.phone;
        const body = `Заказ ${order.number}: статус «${order.status}», сумма ${(order.total / 100).toFixed(2)} ₽. Демо-уведомление, сообщение не отправлялось.`;
        await this.prisma.notification.create({
          data: { eventId: job.data.id, channel: 'DEMO', recipient, body, status: 'SENT' },
        }).catch((error: unknown) => {
          if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') return null;
          throw error;
        });
      }
      this.metrics.eventsProcessed.inc({ type: job.data.type });
    } finally {
      stopTimer();
    }
  }
}
