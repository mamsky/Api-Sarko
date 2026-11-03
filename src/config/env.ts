import { envSchema, type Env } from './env.schema';

/**
 * Snapshot environment yang sudah tervalidasi.
 *
 * Di runtime NestJS, `ConfigService` adalah jalur utama (lihat `app.config.ts`).
 * Objek ini dipakai oleh skrip non-DI: seed, drizzle-kit, worker bootstrap.
 */
export const env: Env = envSchema.parse(process.env);
