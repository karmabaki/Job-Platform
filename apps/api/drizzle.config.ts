import { defineConfig } from 'drizzle-kit';
import path from 'node:path';
import process from 'node:process';

process.loadEnvFile(path.resolve(__dirname, '.env'));

if (!process.env.DATABASE_URL) {
  throw new Error('DATABASE_URL is not set in apps/api/.env');
}

export default defineConfig({
  schema: './src/db/*.ts',
  out: './drizzle',
  dialect: 'postgresql',
  dbCredentials: {
    url: process.env.DATABASE_URL,
  },
});
