import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import IORedis, { type Redis } from 'ioredis';
import { AppConfigService } from './app-config.service';
import { CircuitBreaker } from './circuit-breaker';
import { MetricsService } from './metrics.service';

@Injectable()
export class RedisService implements OnModuleInit, OnModuleDestroy {
  private readonly client: Redis;
  private readonly breaker = new CircuitBreaker();

  constructor(
    private readonly config: AppConfigService,
    private readonly metrics: MetricsService,
  ) {
    this.client = new IORedis(config.redisUrl, {
      lazyConnect: true,
      enableOfflineQueue: false,
      maxRetriesPerRequest: 1,
      connectTimeout: 1_000,
      retryStrategy: (attempt) => Math.min(attempt * 250, 3_000),
    });
    this.client.on('ready', () => {
      this.metrics.dependencyState.set({ dependency: 'redis' }, 1);
      this.breaker.reset();
    });
    this.client.on('end', () => {
      this.metrics.dependencyState.set({ dependency: 'redis' }, 0);
    });
    this.client.on('error', () => {
      this.metrics.redisFailures.inc();
      this.metrics.dependencyState.set({ dependency: 'redis' }, 0);
    });
  }

  async onModuleInit(): Promise<void> {
    await this.client.connect().catch(() => undefined);
  }

  async onModuleDestroy(): Promise<void> {
    this.client.disconnect();
  }

  async getJson<T>(key: string): Promise<T | null> {
    return this.breaker.execute(
      async () => {
        const value = await this.client.get(key);
        this.metrics.cacheLookups.inc({ result: value === null ? 'miss' : 'hit' });
        return value === null ? null : (JSON.parse(value) as T);
      },
      async () => {
        this.metrics.cacheLookups.inc({ result: 'bypass' });
        return null;
      },
    );
  }

  async setJson(key: string, value: unknown, ttlSeconds: number): Promise<void> {
    try {
      await this.breaker.execute(async () => {
        const jitter = Math.floor(Math.random() * 30);
        await this.client.set(key, JSON.stringify(value), 'EX', ttlSeconds + jitter);
      });
    } catch {
      this.metrics.redisFailures.inc();
    }
  }

  async invalidate(pattern: string): Promise<void> {
    try {
      await this.breaker.execute(async () => {
        let cursor = '0';
        do {
          const [nextCursor, keys] = await this.client.scan(cursor, 'MATCH', pattern, 'COUNT', 100);
          cursor = nextCursor;
          if (keys.length > 0) await this.client.del(...keys);
        } while (cursor !== '0');
      });
    } catch {
      this.metrics.redisFailures.inc();
    }
  }

  async deleteKey(key: string): Promise<void> {
    try {
      await this.breaker.execute(async () => {
        await this.client.del(key);
      });
    } catch {
      this.metrics.redisFailures.inc();
    }
  }

  async rateLimit(key: string, limit: number, windowSeconds: number): Promise<boolean> {
    try {
      return await this.breaker.execute(async () => {
        const count = await this.client.incr(key);
        if (count === 1) await this.client.expire(key, windowSeconds);
        return count <= limit;
      });
    } catch {
      return true;
    }
  }

  async ping(): Promise<boolean> {
    try {
      return (await this.client.ping()) === 'PONG';
    } catch {
      return false;
    }
  }

}
