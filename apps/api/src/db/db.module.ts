import { Module } from '@nestjs/common';
import { neon } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-http';
import { requireEnv } from '../env';

export const DB = Symbol('DB');

@Module({
  providers: [
    {
      provide: DB,
      useFactory: () => drizzle(neon(requireEnv('DATABASE_URL'))),
    },
  ],
  exports: [DB],
})
export class DbModule {}
