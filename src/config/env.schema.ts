import { z } from 'zod';

/**
 * Satu-satunya tempat `process.env` dibaca dan divalidasi (plan §2.1).
 *
 * Semua nilai punya default yang aman untuk development supaya
 * `pnpm --filter @sarko/api test` bisa jalan tanpa file `.env`.
 */
export const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().positive().max(65535).default(3000),
  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent']).default('info'),
  CORS_ORIGINS: z.string().default('http://localhost:5173,http://localhost:8081'),

  DATABASE_URL: z
    .string()
    .url()
    .default('postgresql://sarko:sarko@localhost:5432/sarko'),
  REDIS_URL: z.string().url().default('redis://localhost:6379'),

  JWT_SECRET: z.string().min(16).default('sarko-development-secret-change-me'),
  JWT_EXPIRES_IN: z.string().default('15m'),
  JWT_REFRESH_EXPIRES_IN: z.string().default('30d'),

  S3_ENDPOINT: z.string().url().default('http://localhost:9000'),
  S3_REGION: z.string().default('ap-southeast-1'),
  S3_BUCKET: z.string().default('sarko-media'),
  S3_ACCESS_KEY_ID: z.string().default('minioadmin'),
  S3_SECRET_ACCESS_KEY: z.string().default('minioadmin'),
  S3_FORCE_PATH_STYLE: z.coerce.boolean().default(true),

  PAYMENT_GATEWAY_NAME: z.string().default('midtrans'),
  PAYMENT_GATEWAY_BASE_URL: z.string().url().default('https://api.sandbox.midtrans.com'),
  PAYMENT_GATEWAY_SERVER_KEY: z.string().default('sandbox-server-key'),
  PAYMENT_GATEWAY_CLIENT_KEY: z.string().default('sandbox-client-key'),
  PAYMENT_GATEWAY_WEBHOOK_SECRET: z.string().min(1).default('change-me-webhook-secret'),
  PAYMENT_GATEWAY_WEBHOOK_TOLERANCE_SECONDS: z.coerce.number().int().positive().default(300),

  HUB_KEY_PEPPER: z.string().min(1).default('change-me-hub-key-pepper'),

  BUSINESS_TIMEZONE: z.string().default('Asia/Jakarta'),
  BUSINESS_CUTOFF_HOUR: z.coerce.number().int().min(0).max(23).default(4),

  /** PIN lockout (PRD FR-AUTH): 5 percobaan gagal → kunci 5 menit. */
  PIN_MAX_ATTEMPTS: z.coerce.number().int().positive().default(5),
  PIN_LOCK_MINUTES: z.coerce.number().int().positive().default(5),

  /** Device dianggap hilang bila `last_seen_at` lebih tua dari ini (detik). */
  DEVICE_HEARTBEAT_TIMEOUT_SECONDS: z.coerce.number().int().positive().default(600),

  /** Loyalty: 1 poin per kelipatan rupiah ini (PRD FR-APP-07). */
  LOYALTY_RUPIAH_PER_POINT: z.coerce.number().int().positive().default(1000),
});

export type Env = z.infer<typeof envSchema>;

/** Dipakai `ConfigModule.forRoot({ validate })` — melempar pesan jelas saat env rusak. */
export function validateEnv(raw: Record<string, unknown>): Env {
  const parsed = envSchema.safeParse(raw);
  if (!parsed.success) {
    const details = parsed.error.issues
      .map((issue) => `  - ${issue.path.join('.') || '(root)'}: ${issue.message}`)
      .join('\n');
    throw new Error(`Konfigurasi environment tidak valid:\n${details}`);
  }
  return parsed.data;
}
