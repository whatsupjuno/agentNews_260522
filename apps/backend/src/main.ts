import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { ValidationPipe, Logger } from '@nestjs/common';
import { AppModule } from './app.module';
import { DisguiseExceptionFilter } from './presentation/filters/disguise-exception.filter';
import { ResponseFormatInterceptor } from './presentation/interceptors/response-format.interceptor';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule, { logger: ['error', 'warn', 'log', 'debug'] });

  app.setGlobalPrefix('api/v1');

  // CORS — 환경변수 CORS_ORIGIN 으로 제어. 콤마 구분 origin, 또는 '*' wildcard.
  // 모바일 native 만 쓰면 무관하지만 운영 시 안전망.
  const corsRaw = (process.env.CORS_ORIGIN ?? '*').trim();
  const corsOrigin =
    corsRaw === '*'
      ? true
      : corsRaw
          .split(',')
          .map((s) => s.trim())
          .filter(Boolean);
  app.enableCors({
    origin: corsOrigin,
    credentials: false,
    allowedHeaders: [
      'Content-Type',
      'Authorization',
      'X-Refresh-Token',
      'X-Unlock-Token',
      'X-Trace-Id',
      'Idempotency-Key',
    ],
  });

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: { enableImplicitConversion: false },
    }),
  );

  app.useGlobalFilters(new DisguiseExceptionFilter());
  app.useGlobalInterceptors(new ResponseFormatInterceptor());

  const port = Number(process.env.BACKEND_PORT ?? 3000);
  await app.listen(port, '0.0.0.0'); // 외부 접근 허용 (Docker / 서버 배포)
  Logger.log(
    `agentNews backend listening on :${port} (cors=${corsRaw})`,
    'Bootstrap',
  );
}

void bootstrap();
