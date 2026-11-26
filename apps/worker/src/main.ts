import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { OutboxPoller } from './outbox.poller';
import { WorkerConfigService } from './worker-config.service';
import { WorkerModule } from './worker.module';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create<NestExpressApplication>(WorkerModule, { bufferLogs: true });
  const config = app.get(WorkerConfigService);
  app.disable('x-powered-by');
  app.enableShutdownHooks();
  const poller = app.get(OutboxPoller);
  const timer = setInterval(() => {
    void poller.refreshQueueMetrics().catch(() => undefined);
  }, 10_000);
  timer.unref();
  await app.listen(config.port, '0.0.0.0');
  console.log(JSON.stringify({ level: 'info', message: 'Worker запущен', port: config.port }));
}

bootstrap().catch((error: unknown) => {
  console.error(JSON.stringify({ level: 'error', message: error instanceof Error ? error.message : 'Ошибка запуска worker' }));
  process.exitCode = 1;
});
