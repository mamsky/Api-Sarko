import 'reflect-metadata';

import { Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { ClsService } from 'nestjs-cls';
import { Logger as PinoLogger } from 'nestjs-pino';

import { AppModule } from './app.module';
import { ProblemDetailFilter } from './shared/errors/problem-detail.filter';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule, {
    // rawBody wajib untuk verifikasi HMAC webhook (PRD §7.9).
    rawBody: true,
    bufferLogs: true,
  });

  app.useLogger(app.get(PinoLogger));

  // Validasi request memakai `ZodValidationPipe` + schema `@sarko/contracts`
  // per-endpoint. `ValidationPipe` Nest tidak dipakai karena butuh
  // `class-validator` dan akan menduplikasi aturan yang sudah ada di kontrak.

  app.useGlobalFilters(new ProblemDetailFilter(app.get(ClsService)));

  // Alias `/api/v1/*` → `/v1/*`. Prefix `v1` ditulis di masing-masing
  // controller, jadi menambah global prefix akan memutus semua route yang
  // sudah dipakai POS, KDS, dan admin. Rewrite di lapisan HTTP membuat kedua
  // bentuk URL hidup berdampingan tanpa menyentuh satu controller pun.
  const expressApp = app.getHttpAdapter().getInstance() as {
    use: (handler: (req: { url: string }, res: unknown, next: () => void) => void) => void;
  };
  expressApp.use((req, res, next) => {
    if (req.url === '/api/v1' || req.url.startsWith('/api/v1/')) {
      req.url = req.url.slice('/api'.length);
    } else if (req.url === '/api/docs' || req.url.startsWith('/api/docs/')) {
      req.url = req.url.slice('/api'.length);
    }
    next();
  });

  const corsOrigins = (process.env.CORS_ORIGINS ?? 'http://localhost:5173,http://localhost:8081')
    .split(',')
    .map((origin) => origin.trim())
    .filter((origin) => origin.length > 0);

  // `credentials: true` melarang `Access-Control-Allow-Origin: *` menurut spec,
  // jadi wildcard TIDAK boleh diteruskan sebagai string/array "*": browser akan
  // menolaknya dan header tidak terkirim sama sekali. Satu-satunya cara legal
  // mengizinkan semua origin sambil tetap mengirim cookie/Authorization adalah
  // memantulkan origin request lewat `origin: true`.
  const allowAllOrigins = corsOrigins.includes('*');
  app.enableCors({
    origin: allowAllOrigins ? true : corsOrigins,
    credentials: true,
  });

  const swaggerConfig = new DocumentBuilder()
    .setTitle('SARKO API')
    .setDescription('Cloud API SARKO — POS, KDS, Web Admin, Mobile App')
    .setVersion('1.0')
    .addBearerAuth({ type: 'http', scheme: 'bearer', bearerFormat: 'JWT' }, 'bearer')
    .build();
  const document = SwaggerModule.createDocument(app, swaggerConfig);
  SwaggerModule.setup('docs', app, document);

  app.enableShutdownHooks();

  const port = Number(process.env.PORT ?? 3000);
  await app.listen(port, '0.0.0.0');

  Logger.log(`SARKO API berjalan di http://localhost:${port} (docs: /docs)`, 'Bootstrap');
}

void bootstrap();
