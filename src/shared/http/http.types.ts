/**
 * Bentuk minimal `Request`/`Response` Express yang dipakai SARKO.
 *
 * Didefinisikan lokal supaya `apps/api` tidak bergantung pada `@types/express`
 * (pnpm mengisolasi dependensi transitif `@nestjs/platform-express`).
 * Hanya properti yang benar-benar dipakai yang dideklarasikan.
 */
export type HttpHeaders = Record<string, string | string[] | undefined>;

export type HttpRequestLike = {
  method: string;
  url: string;
  originalUrl?: string;
  path?: string;
  headers: HttpHeaders;
  body?: unknown;
  ip?: string;
  route?: { path?: string };
  user?: { id?: string; sub?: string; email?: string; role?: string; outletIds?: string[] };
};

export type HttpResponseLike = {
  statusCode: number;
  status(code: number): HttpResponseLike;
  json(body: unknown): HttpResponseLike;
  setHeader(name: string, value: string): void;
  send(body?: unknown): void;
};
