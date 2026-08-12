import { Module } from '@nestjs/common';
import { neon, neonConfig, Pool } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-http';
import { drizzle as drizzlePool } from 'drizzle-orm/neon-serverless';
import ws from 'ws';
import { requireEnv } from '../env';

neonConfig.webSocketConstructor = ws;

export const DB = Symbol('DB');

// Transaction-capable connection. drizzle-orm/neon-http sends each
// query as an independent HTTP request — there's no persistent
// connection, so it cannot support real BEGIN/COMMIT transactions
// (confirmed by testing: it throws "No transactions support in
// neon-http driver"). DB_TX uses a real WebSocket-backed Pool instead,
// solely for the few operations that genuinely need atomicity across
// multiple statements (e.g. replacing a candidate's whole skill set).
// Everything else keeps using the simpler, stateless DB connection.
export const DB_TX = Symbol('DB_TX');

@Module({
  providers: [
    {
      provide: DB,
      useFactory: () => drizzle(neon(requireEnv('DATABASE_URL'))),
    },
    {
      provide: DB_TX,
      useFactory: () =>
        drizzlePool(new Pool({ connectionString: requireEnv('DATABASE_URL') })),
    },
  ],
  exports: [DB, DB_TX],
})
export class DbModule {}
