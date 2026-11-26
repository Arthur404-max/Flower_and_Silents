import { Injectable } from '@nestjs/common';
import { Counter, Gauge, Histogram, Registry, collectDefaultMetrics } from 'prom-client';

@Injectable()
export class MetricsService {
  readonly registry = new Registry();
  readonly httpRequests = new Counter({
    name: 'cvetotishina_http_requests_total',
    help: 'Total HTTP requests',
    labelNames: ['method', 'route', 'status'] as const,
    registers: [this.registry],
  });
  readonly httpDuration = new Histogram({
    name: 'cvetotishina_http_request_duration_seconds',
    help: 'HTTP request duration',
    labelNames: ['method', 'route'] as const,
    buckets: [0.05, 0.1, 0.3, 0.7, 1.5, 3, 5],
    registers: [this.registry],
  });
  readonly cacheLookups = new Counter({
    name: 'cvetotishina_cache_lookups_total',
    help: 'Cache lookup outcomes',
    labelNames: ['result'] as const,
    registers: [this.registry],
  });
  readonly redisFailures = new Counter({
    name: 'cvetotishina_redis_failures_total',
    help: 'Redis operation failures',
    registers: [this.registry],
  });
  readonly dependencyState = new Gauge({
    name: 'cvetotishina_dependency_up',
    help: 'Dependency availability: 1 up, 0 down',
    labelNames: ['dependency'] as const,
    registers: [this.registry],
  });
  readonly ordersCreated = new Counter({
    name: 'cvetotishina_orders_created_total',
    help: 'Created orders',
    registers: [this.registry],
  });
  readonly ordersPaid = new Counter({
    name: 'cvetotishina_orders_paid_total',
    help: 'Paid orders',
    registers: [this.registry],
  });
  readonly orderRevenue = new Counter({
    name: 'cvetotishina_order_revenue_kopecks_total',
    help: 'Revenue from paid orders in kopecks',
    registers: [this.registry],
  });

  constructor() {
    collectDefaultMetrics({ register: this.registry });
    this.dependencyState.set({ dependency: 'redis' }, 0);
  }
}
