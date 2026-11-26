import { Injectable } from '@nestjs/common';

@Injectable()
export class AppConfigService {
  readonly apiPort = Number(process.env.API_PORT ?? 3000);
  readonly workerPort = Number(process.env.WORKER_PORT ?? 3001);
  readonly databaseUrl = this.required('DATABASE_URL');
  readonly redisUrl = this.required('REDIS_URL');
  readonly allowedOrigins = (process.env.WEB_ORIGIN ?? 'http://localhost:8080')
    .split(',')
    .map((origin) => origin.trim().replace(/\/$/, ''))
    .filter(Boolean);
  readonly webOrigin = this.allowedOrigins[0];
  readonly jwtSecret = this.required('JWT_SECRET', 32);
  readonly adminEmail = this.required('ADMIN_EMAIL').toLowerCase();
  readonly adminPassword = this.required('ADMIN_PASSWORD', 12);
  readonly uploadDir = process.env.UPLOAD_DIR ?? './uploads';
  readonly demoMode = process.env.DEMO_MODE !== 'false';
  readonly cookieSecure = process.env.COOKIE_SECURE === 'true';
  readonly nodeEnv = process.env.NODE_ENV ?? 'development';

  constructor() {
    if (!Number.isInteger(this.apiPort) || !Number.isInteger(this.workerPort)) {
      throw new Error('API_PORT и WORKER_PORT должны быть целыми числами');
    }
  }

  private required(name: string, minLength = 1): string {
    const value = process.env[name];
    if (!value || value.length < minLength) {
      throw new Error(`${name} обязателен и должен содержать не менее ${minLength} символов`);
    }
    return value;
  }
}
