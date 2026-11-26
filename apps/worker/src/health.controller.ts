import { Controller, Get, Header, Res, ServiceUnavailableException } from '@nestjs/common';
import type { Response } from 'express';
import { MetricsService } from './metrics.service';
import { PrismaService } from './prisma.service';
import { QueueService } from './queue.service';

@Controller()
export class HealthController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly queue: QueueService,
    private readonly metrics: MetricsService,
  ) {}

  @Get('health/live')
  live(): { status: string } {
    return { status: 'ok' };
  }

  @Get('health/ready')
  async ready(): Promise<{ status: string }> {
    const [database, redis] = await Promise.all([
      this.prisma.$queryRaw`SELECT 1`.then(() => true).catch(() => false),
      this.queue.ping(),
    ]);
    if (!database || !redis) throw new ServiceUnavailableException('Зависимости worker недоступны');
    return { status: 'ok' };
  }

  @Get('metrics')
  @Header('Content-Type', 'text/plain; version=0.0.4; charset=utf-8')
  async render(@Res() response: Response): Promise<void> {
    response.send(await this.metrics.registry.metrics());
  }
}
