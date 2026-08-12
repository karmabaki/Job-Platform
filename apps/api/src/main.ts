import path from 'node:path';
import process from 'node:process';
import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import cookieParser from 'cookie-parser';
import { AppModule } from './app.module';
import { requireEnv } from './env';

async function bootstrap() {
  // Must run before NestFactory.create() — that's what instantiates
  // DbModule/AuthModule's providers (DATABASE_URL, JWT_SECRET), and
  // those are only deferred (not read at import time) because they're
  // useFactory providers. Placing this as the first statement here,
  // rather than at module top-level, sidesteps any question of import
  // hoisting order entirely.
  process.loadEnvFile(path.resolve(__dirname, '../.env'));

  const app = await NestFactory.create(AppModule);
  // credentials: true is required for the browser to send the
  // httpOnly session cookie on cross-origin requests from apps/web.
  app.enableCors({ origin: requireEnv('WEB_ORIGIN'), credentials: true });
  app.use(cookieParser());
  app.useGlobalPipes(
    new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true }),
  );
  await app.listen(process.env.PORT ?? 3001);
}
bootstrap();
