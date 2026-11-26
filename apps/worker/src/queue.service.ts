import { Injectable, OnModuleDestroy } from '@nestjs/common';
import { Queue, type Job } from 'bullmq';
import IORedis from 'ioredis';
import { WorkerConfigService } from './worker-config.service';

export interface EventJobData {
  id: string;
  aggregateId: string;
  type: string;
  payload: Record<string, unknown>;
}

@Injectable()
export class QueueService implements OnModuleDestroy {
  readonly queue: Queue<EventJobData>;
  readonly deadLetterQueue: Queue;
  private readonly connection: IORedis;

  constructor(config: WorkerConfigService) {
    this.connection = new IORedis(config.redisUrl, { maxRetriesPerRequest: null });
    this.queue = new Queue<EventJobData>('order-events', {
      connection: this.connection,
      defaultJobOptions: {
        attempts: 5,
        backoff: { type: 'exponential', delay: 1_000 },
        removeOnComplete: 1_000,
        removeOnFail: 2_000,
      },
    });
    this.deadLetterQueue = new Queue('order-events-dlq', { connection: this.connection });
  }

  async enqueue(event: EventJobData): Promise<void> {
    await this.queue.add(event.type, event, { jobId: event.id });
  }

  async deadLetter(job: Job<EventJobData>): Promise<void> {
    await this.deadLetterQueue.add(job.name, {
      originalJobId: job.id,
      data: job.data,
      failedReason: job.failedReason,
      attemptsMade: job.attemptsMade,
    }, { jobId: `dlq-${job.id}` });
  }

  async refreshMetrics(): Promise<Record<string, number>> {
    return this.queue.getJobCounts('waiting', 'active', 'failed', 'delayed');
  }

  async invalidateCatalog(): Promise<void> {
    try {
      let cursor = '0';
      do {
        const [nextCursor, keys] = await this.connection.scan(cursor, 'MATCH', 'catalog:v2:*', 'COUNT', 100);
        cursor = nextCursor;
        if (keys.length > 0) await this.connection.del(...keys);
      } while (cursor !== '0');
    } catch {
      console.error(JSON.stringify({ level: 'error', component: 'cache', message: 'Catalog invalidation failed' }));
    }
  }

  async ping(): Promise<boolean> {
    try {
      return (await this.connection.ping()) === 'PONG';
    } catch {
      return false;
    }
  }

  async onModuleDestroy(): Promise<void> {
    await this.queue.close();
    await this.deadLetterQueue.close();
    this.connection.disconnect();
  }
}
