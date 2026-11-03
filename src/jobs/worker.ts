import 'reflect-metadata';

import { Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';

import { WorkerModule } from './worker.module';

/** Entry point container worker: tidak membuka port, hanya menjalankan cron. */
async function bootstrap(): Promise<void> {
  const logger = new Logger('WorkerBootstrap');
  const app = await NestFactory.createApplicationContext(WorkerModule, {
    logger: ['error', 'warn', 'log'],
  });

  app.enableShutdownHooks();

  const shutdown = async (signal: string): Promise<void> => {
    logger.log(`Menerima ${signal}, menutup worker…`);
    await app.close();
    process.exit(0);
  };

  process.on('SIGTERM', () => void shutdown('SIGTERM'));
  process.on('SIGINT', () => void shutdown('SIGINT'));

  logger.log('Worker SARKO berjalan — job terjadwal aktif');
}

void bootstrap();
