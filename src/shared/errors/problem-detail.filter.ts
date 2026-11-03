import { randomUUID } from 'node:crypto';

import {
  type ArgumentsHost,
  Catch,
  type ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { ClsService } from 'nestjs-cls';
import type { HttpRequestLike, HttpResponseLike } from '../http/http.types';
import { ProblemCodes, type ProblemCode, problemDetailSchema } from '@sarko/contracts';
import { ZodError } from 'zod';

import { AppError, type AppErrorField } from './app-error';

const PROBLEM_BASE_URL = 'https://api.sarko.id/errors';

const STATUS_TO_CODE: Record<number, ProblemCode> = {
  400: ProblemCodes.VALIDATION_FAILED,
  401: ProblemCodes.UNAUTHENTICATED,
  403: ProblemCodes.FORBIDDEN,
  404: ProblemCodes.NOT_FOUND,
  409: ProblemCodes.CONFLICT,
  422: ProblemCodes.VALIDATION_FAILED,
  429: ProblemCodes.RATE_LIMITED,
  500: ProblemCodes.INTERNAL_ERROR,
};

/** `type` problem diambil dari kode: `ORDER_ALREADY_PAID` → `.../order-already-paid`. */
function problemType(code: string): string {
  return `${PROBLEM_BASE_URL}/${code.toLowerCase().replace(/_/g, '-')}`;
}

function zodIssuesToFields(error: ZodError): AppErrorField[] {
  return error.issues.map((issue) => ({
    field: issue.path.length > 0 ? issue.path.join('.') : '(root)',
    message: issue.message,
  }));
}

/**
 * Filter global yang memaksa SELURUH error keluar dalam bentuk RFC 7807
 * (`problemDetailSchema`) — PRD §10, plan §2.1.
 */
@Catch()
export class ProblemDetailFilter implements ExceptionFilter {
  private readonly logger = new Logger(ProblemDetailFilter.name);

  constructor(private readonly cls?: ClsService) {}

  catch(exception: unknown, host: ArgumentsHost): void {
    const context = host.switchToHttp();
    const response = context.getResponse<HttpResponseLike>();
    const request = context.getRequest<HttpRequestLike>();

    const problem = this.toProblem(exception, request);
    const validated = problemDetailSchema.safeParse(problem);

    if (!validated.success) {
      this.logger.error(
        { err: validated.error, problem },
        'Problem detail yang dihasilkan tidak sesuai kontrak',
      );
      response.status(HttpStatus.INTERNAL_SERVER_ERROR).json({
        type: problemType(ProblemCodes.INTERNAL_ERROR),
        title: 'Kesalahan internal',
        status: 500,
        detail: 'Gagal membentuk response error',
        code: ProblemCodes.INTERNAL_ERROR,
      });
      return;
    }

    if (problem.status >= 500) {
      this.logger.error({ err: exception, path: request.url }, problem.detail);
    } else {
      this.logger.debug({ path: request.url, code: problem.code }, problem.detail);
    }

    response.status(problem.status).json(validated.data);
  }

  private toProblem(exception: unknown, request: HttpRequestLike): ProblemDetailShape {
    const traceId = this.traceId();
    const instance = request.originalUrl ?? request.url;

    if (exception instanceof AppError) {
      return {
        type: problemType(exception.code),
        title: exception.title,
        status: exception.status,
        detail: exception.detail,
        instance,
        code: exception.code,
        ...(exception.errors === undefined ? {} : { errors: exception.errors }),
        trace_id: traceId,
      };
    }

    if (exception instanceof ZodError) {
      const errors = zodIssuesToFields(exception);
      return {
        type: problemType(ProblemCodes.VALIDATION_FAILED),
        title: 'Validasi gagal',
        status: 400,
        detail: errors[0]?.message ?? 'Payload tidak valid',
        instance,
        code: ProblemCodes.VALIDATION_FAILED,
        errors,
        trace_id: traceId,
      };
    }

    if (exception instanceof HttpException) {
      const status = exception.getStatus();
      const code = STATUS_TO_CODE[status] ?? ProblemCodes.INTERNAL_ERROR;
      const body = exception.getResponse();
      const detail = extractHttpMessage(body, exception.message);
      return {
        type: problemType(code),
        title: titleForStatus(status),
        status,
        detail,
        instance,
        code,
        ...(status === 400 ? { errors: [{ field: '(root)', message: detail }] } : {}),
        trace_id: traceId,
      };
    }

    const detail = exception instanceof Error ? exception.message : 'Terjadi kesalahan internal';
    return {
      type: problemType(ProblemCodes.INTERNAL_ERROR),
      title: 'Kesalahan internal',
      status: 500,
      detail,
      instance,
      code: ProblemCodes.INTERNAL_ERROR,
      trace_id: traceId,
    };
  }

  private traceId(): string {
    const fromCls = this.cls?.getId?.();
    return typeof fromCls === 'string' && fromCls.length > 0 ? fromCls : randomUUID();
  }
}

type ProblemDetailShape = {
  type: string;
  title: string;
  status: number;
  detail: string;
  instance?: string;
  code: ProblemCode;
  errors?: AppErrorField[];
  trace_id?: string;
};

function titleForStatus(status: number): string {
  switch (status) {
    case 400:
      return 'Validasi gagal';
    case 401:
      return 'Belum terautentikasi';
    case 403:
      return 'Akses ditolak';
    case 404:
      return 'Sumber daya tidak ditemukan';
    case 409:
      return 'Konflik state';
    case 422:
      return 'Validasi bisnis gagal';
    case 429:
      return 'Terlalu banyak permintaan';
    default:
      return 'Kesalahan internal';
  }
}

function extractHttpMessage(body: string | object, fallback: string): string {
  if (typeof body === 'string') {
    return body;
  }
  const message = (body as { message?: unknown }).message;
  if (typeof message === 'string') {
    return message;
  }
  if (Array.isArray(message) && message.every((item) => typeof item === 'string')) {
    return message.join('; ');
  }
  return fallback;
}
