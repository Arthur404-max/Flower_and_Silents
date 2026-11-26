import { Controller, Get, ServiceUnavailableException } from '@nestjs/common';
import { PrismaService } from './prisma.service';
import { RedisService } from './redis.service';

@Controller('health')
export class HealthController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
  ) {}

  @Get('live')
  live(): { status: string } {
    return { status: 'ok' };
  }

  @Get('ready')
  async ready(): Promise<{ status: string; dependencies: { database: string; redis: string } }> {
    let database = 'up';
    try {
      await this.prisma.$queryRaw`SELECT 1`;
    } catch {
      database = 'down';
    }
    const redis = (await this.redis.ping()) ? 'up' : 'down';
    if (database === 'down') throw new ServiceUnavailableException('База данных недоступна');
    return { status: 'ok', dependencies: { database, redis } };
  }
}
