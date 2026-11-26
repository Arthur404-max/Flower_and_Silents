import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from './prisma.service';
import { QueueService, type EventJobData } from './queue.service';
import { MetricsService } from './metrics.service';

interface RawOutboxEvent {
  id: string;
  aggregateType: string;
  aggregateId: string;
  type: string;
  payload: Prisma.JsonValue;
  attempts: number;
}

@Injectable()
export class OutboxPoller implements OnModuleInit, OnModuleDestroy {
  private timer: NodeJS.Timeout | undefined;
  private running = false;

  constructor(
    private readonly prisma: PrismaService,
    private readonly queue: QueueService,
    private readonly metrics: MetricsService,
  ) {}

  onModuleInit(): void {
    this.timer = setInterval(() => {
      void this.publishPending();
    }, 2_000);
    this.timer.unref();
  }

  onModuleDestroy(): void {
    if (this.timer) clearInterval(this.timer);
  }

  async publishPending(): Promise<void> {
    if (this.running) return;
    this.running = true;
    try {
      const events = await this.prisma.$queryRaw<RawOutboxEvent[]>(Prisma.sql`
        UPDATE "OutboxEvent" AS event
        SET status = 'PROCESSING', attempts = event.attempts + 1,
            "lockedUntil" = NOW() + INTERVAL '30 seconds', "updatedAt" = NOW()
        FROM (
          SELECT id FROM "OutboxEvent"
          WHERE (status IN ('PENDING', 'FAILED') AND "availableAt" <= NOW())
             OR (status = 'PROCESSING' AND "lockedUntil" < NOW())
          ORDER BY "availableAt" ASC
          LIMIT 20
          FOR UPDATE SKIP LOCKED
        ) AS candidate
        WHERE event.id = candidate.id
        RETURNING event.id, event."aggregateType", event."aggregateId", event.type, event.payload, event.attempts
      `);

      for (const event of events) {
        try {
          await this.queue.enqueue({
            id: event.id,
            aggregateId: event.aggregateId,
            type: event.type,
            payload: this.payloadObject(event.payload),
          });
          await this.prisma.outboxEvent.update({
            where: { id: event.id },
            data: { status: 'PUBLISHED', publishedAt: new Date(), lockedUntil: null, lastError: null },
          });
        } catch (error) {
          const dead = event.attempts >= 5;
          await this.prisma.outboxEvent.update({
            where: { id: event.id },
            data: {
              status: dead ? 'DEAD' : 'FAILED',
              availableAt: new Date(Date.now() + Math.min(1_000 * 2 ** (event.attempts - 1), 60_000)),
              lockedUntil: null,
              lastError: this.errorMessage(error),
            },
          });
          this.metrics.eventsFailed.inc();
        }
      }

      const [pending, dead] = await Promise.all([
        this.prisma.outboxEvent.count({ where: { status: { in: ['PENDING', 'FAILED', 'PROCESSING'] } } }),
        this.prisma.outboxEvent.count({ where: { status: 'DEAD' } }),
      ]);
      this.metrics.outboxPending.set(pending);
      this.metrics.outboxDead.set(dead);
    } catch (error) {
      this.metrics.eventsFailed.inc();
      console.error(JSON.stringify({ level: 'error', component: 'outbox', message: this.errorMessage(error) }));
    } finally {
      this.running = false;
    }
  }

  async refreshQueueMetrics(): Promise<void> {
    const counts = await this.queue.refreshMetrics();
    for (const [state, count] of Object.entries(counts)) {
      this.metrics.queueJobs.set({ queue: 'order-events', state }, count);
    }
    const dlq = await this.queue.deadLetterQueue.getJobCounts('waiting');
    this.metrics.queueJobs.set({ queue: 'order-events-dlq', state: 'waiting' }, dlq.waiting ?? 0);
  }

  private payloadObject(payload: Prisma.JsonValue): Record<string, unknown> {
    if (payload && typeof payload === 'object' && !Array.isArray(payload)) return payload as Record<string, unknown>;
    return {};
  }

  private errorMessage(error: unknown): string {
    return (error instanceof Error ? error.message : 'Unknown error').slice(0, 500);
  }
}
