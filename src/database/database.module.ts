import { Global, Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';

import * as schema from './schema';
import { DRIZZLE, DrizzleService, PG_POOL } from './drizzle.service';

@Global()
@Module({
  providers: [
    {
      provide: PG_POOL,
      inject: [ConfigService],
      useFactory: (config: ConfigService): Pool => {
        const connectionString = config.get<string>(
          'DATABASE_URL',
          'postgresql://sarko:sarko@localhost:5432/sarko',
        );
        return new Pool({
          connectionString,
          max: config.get<string>('NODE_ENV') === 'test' ? 4 : 20,
          idleTimeoutMillis: 30_000,
          connectionTimeoutMillis: 5_000,
        });
      },
    },
    {
      provide: DRIZZLE,
      inject: [PG_POOL],
      useFactory: (pool: Pool) => drizzle(pool, { schema }),
    },
    DrizzleService,
  ],
  exports: [DRIZZLE, PG_POOL, DrizzleService],
})
export class DatabaseModule {}
