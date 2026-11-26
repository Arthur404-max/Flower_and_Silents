import assert from 'node:assert/strict';
import { afterEach, describe, it } from 'node:test';
import { AppConfigService } from '../common/app-config.service';
import { TokenService } from './token.service';

const originalEnvironment = {
  DATABASE_URL: process.env.DATABASE_URL,
  REDIS_URL: process.env.REDIS_URL,
  JWT_SECRET: process.env.JWT_SECRET,
  ADMIN_EMAIL: process.env.ADMIN_EMAIL,
  ADMIN_PASSWORD: process.env.ADMIN_PASSWORD,
};

afterEach(() => {
  for (const [key, value] of Object.entries(originalEnvironment)) {
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
});

function config(): AppConfigService {
  process.env.DATABASE_URL = 'postgresql://user:pass@localhost:5432/db';
  process.env.REDIS_URL = 'redis://localhost:6379';
  process.env.JWT_SECRET = 'a'.repeat(40);
  process.env.ADMIN_EMAIL = 'admin@example.test';
  process.env.ADMIN_PASSWORD = 'a'.repeat(16);
  return new AppConfigService();
}

describe('TokenService', () => {
  it('подписывает и проверяет access-токен', async () => {
    const service = new TokenService(config());
    const identity = { id: 'user-id', email: 'admin@example.test', name: 'Администратор' };
    const token = await service.signAccess(identity);
    assert.deepEqual(await service.verifyAccess(token), identity);
  });

  it('отклоняет изменённый токен', async () => {
    const service = new TokenService(config());
    const token = await service.signAccess({ id: 'user-id', email: 'admin@example.test', name: 'Admin' });
    await assert.rejects(service.verifyAccess(`${token}x`), /Требуется вход/);
  });

  it('создаёт разные refresh и CSRF токены', () => {
    const service = new TokenService(config());
    assert.notEqual(service.createRefreshToken(), service.createRefreshToken());
    assert.equal(service.createCsrfToken().length, 43);
  });
});
