import { Injectable } from '@nestjs/common';

@Injectable()
export class WorkerConfigService {
  readonly port = Number(process.env.WORKER_PORT ?? 3001);
  readonly databaseUrl = this.required('DATABASE_URL');
  readonly redisUrl = this.required('REDIS_URL');

  constructor() {
    if (!Number.isInteger(this.port)) throw new Error('WORKER_PORT должен быть целым числом');
  }

  private required(name: string): string {
    const value = process.env[name];
    if (!value) throw new Error(`${name} обязателен`);
    return value;
  }
}
