import { HttpException, HttpStatus } from '@nestjs/common';
import type { ArgumentsHost } from '@nestjs/common';
import { ProblemCodes, problemDetailSchema } from '@sarko/contracts';
import { z } from 'zod';

import { AppError } from './app-error';
import { ProblemDetailFilter } from './problem-detail.filter';

type Captured = { status: number; body: Record<string, unknown> };

function buildHost(url = '/v1/orders'): { host: ArgumentsHost; captured: Captured } {
  const captured: Captured = { status: 0, body: {} };
  const response = {
    status(code: number) {
      captured.status = code;
      return this;
    },
    json(payload: Record<string, unknown>) {
      captured.body = payload;
      return this;
    },
  };
  const request = { url, originalUrl: url };

  const host = {
    switchToHttp: () => ({
      getResponse: () => response,
      getRequest: () => request,
      getNext: () => undefined,
    }),
    getArgs: () => [request, response],
    getArgByIndex: () => undefined,
    switchToRpc: () => ({ getData: () => undefined, getContext: () => undefined }),
    switchToWs: () => ({ getClient: () => undefined, getData: () => undefined }),
    getType: () => 'http' as const,
  } as unknown as ArgumentsHost;

  return { host, captured };
}

function run(exception: unknown, url?: string): Captured {
  const { host, captured } = buildHost(url);
  new ProblemDetailFilter().catch(exception, host);
  return captured;
}

describe('ProblemDetailFilter', () => {
  it('memetakan AppError ke bentuk problemDetailSchema yang valid', () => {
    const captured = run(AppError.invalidTransition('PAID', 'DRAFT'));

    expect(captured.status).toBe(409);
    expect(problemDetailSchema.safeParse(captured.body).success).toBe(true);
    expect(captured.body).toMatchObject({
      status: 409,
      code: ProblemCodes.ORDER_INVALID_TRANSITION,
      instance: '/v1/orders',
      type: 'https://api.sarko.id/errors/order-invalid-transition',
      title: 'Transisi status order tidak valid',
    });
    expect(typeof captured.body.trace_id).toBe('string');
  });

  it('menyertakan errors[] per-field untuk kegagalan validasi Zod', () => {
    const schema = z.object({ email: z.string().email(), qty: z.number().int().positive() });
    const parsed = schema.safeParse({ email: 'bukan-email', qty: -1 });
    if (parsed.success) {
      throw new Error('fixture harus gagal');
    }

    const captured = run(parsed.error);

    expect(captured.status).toBe(400);
    expect(problemDetailSchema.safeParse(captured.body).success).toBe(true);
    expect(captured.body.code).toBe(ProblemCodes.VALIDATION_FAILED);
    const errors = captured.body.errors as { field: string; message: string }[];
    expect(errors.map((item) => item.field).sort()).toEqual(['email', 'qty']);
  });

  it('menerjemahkan HttpException Nest menjadi problem detail', () => {
    const captured = run(new HttpException('Order tidak ditemukan', HttpStatus.NOT_FOUND));

    expect(captured.status).toBe(404);
    expect(problemDetailSchema.safeParse(captured.body).success).toBe(true);
    expect(captured.body).toMatchObject({
      status: 404,
      code: ProblemCodes.NOT_FOUND,
      detail: 'Order tidak ditemukan',
    });
  });

  it('tidak membocorkan error tak terduga sebagai 500 problem detail valid', () => {
    const captured = run(new Error('koneksi database putus'));

    expect(captured.status).toBe(500);
    expect(problemDetailSchema.safeParse(captured.body).success).toBe(true);
    expect(captured.body).toMatchObject({
      status: 500,
      code: ProblemCodes.INTERNAL_ERROR,
      detail: 'koneksi database putus',
    });
  });

  it('menangani nilai yang dilempar bukan Error', () => {
    const captured = run('sesuatu yang aneh');

    expect(captured.status).toBe(500);
    expect(problemDetailSchema.safeParse(captured.body).success).toBe(true);
  });

  it('memakai trace_id dari ClsService bila tersedia', () => {
    const { host, captured } = buildHost('/v1/payments');
    const cls = { getId: () => 'trace-abc-123' };
    new ProblemDetailFilter(cls as never).catch(AppError.forbidden(), host);

    expect(captured.body.trace_id).toBe('trace-abc-123');
  });

  it('AppError.idempotencyMissing menghasilkan 400 dengan kode spesifik', () => {
    const captured = run(AppError.idempotencyMissing());

    expect(captured.status).toBe(400);
    expect(captured.body.code).toBe(ProblemCodes.IDEMPOTENCY_KEY_MISSING);
    expect(problemDetailSchema.safeParse(captured.body).success).toBe(true);
  });
});
