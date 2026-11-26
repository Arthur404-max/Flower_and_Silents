import { Injectable } from '@nestjs/common';
import { Counter, Gauge, Histogram, Registry, collectDefaultMetrics } from 'prom-client';

@Injectable()
export class MetricsService {
  readonly registry = new Registry();
  readonly outboxPending = new Gauge({
    name: 'cvetotishina_outbox_pending',
    help: 'Outbox events waiting for publication',
    registers: [this.registry],
  });
  readonly outboxDead = new Gauge({
    name: 'cvetotishina_outbox_dead',
    help: 'Outbox events moved to dead state',
    registers: [this.registry],
  });
  readonly queueJobs = new Gauge({
    name: 'cvetotishina_queue_jobs',
    help: 'Queue jobs by state',
    labelNames: ['queue', 'state'] as const,
    registers: [this.registry],
  });
  readonly eventsProcessed = new Counter({
    name: 'cvetotishina_worker_events_processed_total',
    help: 'Successfully processed events',
    labelNames: ['type'] as const,
    registers: [this.registry],
  });
  readonly eventsFailed = new Counter({
    name: 'cvetotishina_worker_events_failed_total',
    help: 'Failed event processing attempts',
    registers: [this.registry],
  });
  readonly jobDuration = new Histogram({
    name: 'cvetotishina_worker_job_duration_seconds',
    help: 'Event processing duration',
    buckets: [0.05, 0.1, 0.3, 1, 3, 10],
    registers: [this.registry],
  });
  readonly expiredOrders = new Counter({
    name: 'cvetotishina_worker_expired_orders_total',
    help: 'Unpaid orders cancelled after timeout',
    registers: [this.registry],
  });

  constructor() {
    collectDefaultMetrics({ register: this.registry });
  }
}
