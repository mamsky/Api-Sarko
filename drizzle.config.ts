import { defineConfig } from 'drizzle-kit';

/**
 * Drizzle Kit configuration.
 *
 * Migrations are generated as reviewable SQL files into
 * `src/database/migrations` (plan §2.1).
 */
export default defineConfig({
  dialect: 'postgresql',
  schema: './src/database/schema/index.ts',
  out: './src/database/migrations',
  dbCredentials: {
    url: process.env.DATABASE_URL ?? 'postgresql://sarko:sarko@localhost:5432/sarko',
  },
  verbose: true,
  strict: true,
});
