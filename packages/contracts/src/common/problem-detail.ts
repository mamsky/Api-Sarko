import { z } from 'zod';

/**
 * RFC 7807 Problem Details — format error tunggal untuk SELURUH API SARKO.
 * Semua error response (4xx/5xx) memakai bentuk ini, tanpa pengecualian.
 */
export const problemFieldErrorSchema = z.object({
  field: z.string().describe('Path field yang gagal validasi, contoh: "items.0.qty"'),
  message: z.string().describe('Pesan error yang bisa ditampilkan ke pengguna'),
});

export type ProblemFieldError = z.infer<typeof problemFieldErrorSchema>;

/** Stable machine code: SCREAMING_SNAKE_CASE. Client boleh switch-case terhadap nilai ini. */
export const problemCodeSchema = z
  .string()
  .regex(/^[A-Z][A-Z0-9_]*$/, 'code harus SCREAMING_SNAKE_CASE')
  .describe('Kode error stabil untuk mesin, contoh: ORDER_ALREADY_PAID');

export const problemDetailSchema = z.object({
  type: z.string().url().describe('URI identitas tipe problem, contoh: https://api.sarko.id/problems/validation'),
  title: z.string().describe('Ringkasan singkat problem, stabil per tipe'),
  status: z.number().int().min(100).max(599).describe('HTTP status code'),
  detail: z.string().describe('Penjelasan spesifik untuk kejadian ini'),
  instance: z.string().optional().describe('URI resource yang terkena, contoh: /v1/orders/{id}'),
  code: problemCodeSchema,
  errors: z.array(problemFieldErrorSchema).optional().describe('Detail per-field untuk VALIDATION_FAILED'),
  trace_id: z.string().optional().describe('Trace ID untuk korelasi log server'),
});

export type ProblemDetail = z.infer<typeof problemDetailSchema>;

/**
 * Kode problem yang dipakai lintas service.
 * Jangan bikin kode baru di service — tambahkan di sini agar kontrak tetap satu sumber.
 */
export const ProblemCodes = {
  VALIDATION_FAILED: 'VALIDATION_FAILED',
  UNAUTHENTICATED: 'UNAUTHENTICATED',
  FORBIDDEN: 'FORBIDDEN',
  NOT_FOUND: 'NOT_FOUND',
  CONFLICT: 'CONFLICT',
  IDEMPOTENCY_KEY_REUSED: 'IDEMPOTENCY_KEY_REUSED',
  IDEMPOTENCY_KEY_MISSING: 'IDEMPOTENCY_KEY_MISSING',
  ORDER_INVALID_TRANSITION: 'ORDER_INVALID_TRANSITION',
  ORDER_ALREADY_PAID: 'ORDER_ALREADY_PAID',
  STOCK_INSUFFICIENT: 'STOCK_INSUFFICIENT',
  DEVICE_REVOKED: 'DEVICE_REVOKED',
  TOTAL_MISMATCH: 'TOTAL_MISMATCH',
  RATE_LIMITED: 'RATE_LIMITED',
  INTERNAL_ERROR: 'INTERNAL_ERROR',
} as const;

export type ProblemCode = (typeof ProblemCodes)[keyof typeof ProblemCodes];

/** HTTP status default per kode problem — dipakai interceptor agar konsisten. */
export const PROBLEM_CODE_STATUS: Record<ProblemCode, number> = {
  VALIDATION_FAILED: 400,
  UNAUTHENTICATED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  CONFLICT: 409,
  IDEMPOTENCY_KEY_REUSED: 409,
  IDEMPOTENCY_KEY_MISSING: 400,
  ORDER_INVALID_TRANSITION: 409,
  ORDER_ALREADY_PAID: 409,
  STOCK_INSUFFICIENT: 409,
  DEVICE_REVOKED: 401,
  TOTAL_MISMATCH: 422,
  RATE_LIMITED: 429,
  INTERNAL_ERROR: 500,
};
