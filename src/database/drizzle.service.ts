import { Inject, Injectable, Logger, type OnModuleDestroy } from '@nestjs/common';
import { sql } from 'drizzle-orm';
import type { NodePgDatabase } from 'drizzle-orm/node-postgres';
import type { Pool } from 'pg';

import * as schema from './schema';

export const DRIZZLE = Symbol('DRIZZLE');
export const PG_POOL = Symbol('PG_POOL');

export type Database = NodePgDatabase<typeof schema>;

/**
 * Akses tunggal ke PostgreSQL. Service/repository menyuntik kelas ini,
 * tidak pernah membuat `Pool` sendiri.
 */
@Injectable()
export class DrizzleService implements OnModuleDestroy {
  private readonly logger = new Logger(DrizzleService.name);

  constructor(
    @Inject(DRIZZLE) readonly db: Database,
    @Inject(PG_POOL) private readonly pool: Pool,
  ) {}

  /** Transaksi dengan tipe `tx` yang sama seperti `db` (repository bisa dipakai ulang). */
  async transaction<T>(work: (tx: Database) => Promise<T>): Promise<T> {
    return this.db.transaction(async (tx) => work(tx as unknown as Database));
  }

  /** Health check nyata — `SELECT 1` ke PostgreSQL. */
  async ping(): Promise<boolean> {
    try {
      await this.db.execute(sql`SELECT 1`);
      return true;
    } catch (error) {
      this.logger.error({ err: error }, 'Ping PostgreSQL gagal');
      return false;
    }
  }

  async onModuleDestroy(): Promise<void> {
    await this.pool.end();
  }
}
