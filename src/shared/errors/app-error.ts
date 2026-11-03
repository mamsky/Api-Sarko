import { ProblemCodes, type ProblemCode } from '@sarko/contracts';

export type AppErrorField = { field: string; message: string };

/**
 * Satu-satunya cara melempar error bisnis di SARKO (plan §2.4).
 *
 * `code` adalah nilai stabil dari `ProblemCodes` di `@sarko/contracts`, sehingga
 * klien bisa switch-case tanpa parsing pesan. `status` mengikuti
 * `PROBLEM_CODE_STATUS` agar konsisten di seluruh endpoint.
 */
export class AppError extends Error {
  readonly code: ProblemCode;
  readonly status: number;
  readonly detail: string;
  readonly errors?: AppErrorField[];
  readonly title: string;

  constructor(
    code: ProblemCode,
    status: number,
    detail: string,
    options: { title?: string; errors?: AppErrorField[]; cause?: unknown } = {},
  ) {
    super(detail, options.cause === undefined ? undefined : { cause: options.cause });
    this.name = 'AppError';
    this.code = code;
    this.status = status;
    this.detail = detail;
    this.title = options.title ?? DEFAULT_TITLES[code];
    if (options.errors !== undefined && options.errors.length > 0) {
      this.errors = options.errors;
    }
    Error.captureStackTrace?.(this, AppError);
  }

  static notFound(resource: string, detail?: string): AppError {
    return new AppError(
      ProblemCodes.NOT_FOUND,
      404,
      detail ?? `${resource} tidak ditemukan`,
      { title: `${resource} tidak ditemukan` },
    );
  }

  static forbidden(detail = 'Anda tidak berhak melakukan aksi ini'): AppError {
    return new AppError(ProblemCodes.FORBIDDEN, 403, detail);
  }

  static unauthorized(detail = 'Autentikasi diperlukan'): AppError {
    return new AppError(ProblemCodes.UNAUTHENTICATED, 401, detail);
  }

  static conflict(detail: string, code: ProblemCode = ProblemCodes.CONFLICT): AppError {
    return new AppError(code, 409, detail);
  }

  static validation(detail: string, errors?: AppErrorField[]): AppError {
    return new AppError(ProblemCodes.VALIDATION_FAILED, 400, detail, { errors });
  }

  static invalidTransition(from: string, to: string): AppError {
    return new AppError(
      ProblemCodes.ORDER_INVALID_TRANSITION,
      409,
      `Transisi status ${from} → ${to} tidak diizinkan`,
    );
  }

  static idempotencyMissing(): AppError {
    return new AppError(
      ProblemCodes.IDEMPOTENCY_KEY_MISSING,
      400,
      'Header Idempotency-Key wajib untuk request yang memutasi state',
    );
  }

  static idempotencyReused(): AppError {
    return new AppError(
      ProblemCodes.IDEMPOTENCY_KEY_REUSED,
      409,
      'Idempotency-Key sudah dipakai untuk request dengan payload berbeda',
    );
  }

  static alreadyPaid(detail = 'Order sudah dibayar'): AppError {
    return new AppError(ProblemCodes.ORDER_ALREADY_PAID, 409, detail);
  }

  static stockInsufficient(detail: string, errors?: AppErrorField[]): AppError {
    return new AppError(ProblemCodes.STOCK_INSUFFICIENT, 409, detail, { errors });
  }

  static deviceRevoked(detail = 'Device sudah dicabut aksesnya'): AppError {
    return new AppError(ProblemCodes.DEVICE_REVOKED, 401, detail);
  }

  static rateLimited(detail = 'Terlalu banyak permintaan'): AppError {
    return new AppError(ProblemCodes.RATE_LIMITED, 429, detail);
  }

  static totalMismatch(detail: string): AppError {
    return new AppError(ProblemCodes.TOTAL_MISMATCH, 422, detail);
  }

  static internal(detail = 'Terjadi kesalahan internal'): AppError {
    return new AppError(ProblemCodes.INTERNAL_ERROR, 500, detail);
  }
}

const DEFAULT_TITLES: Record<ProblemCode, string> = {
  VALIDATION_FAILED: 'Validasi gagal',
  UNAUTHENTICATED: 'Belum terautentikasi',
  FORBIDDEN: 'Akses ditolak',
  NOT_FOUND: 'Sumber daya tidak ditemukan',
  CONFLICT: 'Konflik state',
  IDEMPOTENCY_KEY_REUSED: 'Idempotency-Key dipakai ulang',
  IDEMPOTENCY_KEY_MISSING: 'Idempotency-Key tidak ada',
  ORDER_INVALID_TRANSITION: 'Transisi status order tidak valid',
  ORDER_ALREADY_PAID: 'Order sudah dibayar',
  STOCK_INSUFFICIENT: 'Stok tidak mencukupi',
  DEVICE_REVOKED: 'Device dicabut',
  TOTAL_MISMATCH: 'Total tidak cocok',
  RATE_LIMITED: 'Terlalu banyak permintaan',
  INTERNAL_ERROR: 'Kesalahan internal',
};

/** Tipe guard untuk `catch` — jangan pakai `instanceof` berulang di service. */
export function isAppError(error: unknown): error is AppError {
  return error instanceof AppError;
}
