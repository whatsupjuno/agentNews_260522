import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { ValidationPipe, Logger } from '@nestjs/common';
import { AppModule } from './app.module';
import { DisguiseExceptionFilter } from './presentation/filters/disguise-exception.filter';
import { ResponseFormatInterceptor } from './presentation/interceptors/response-format.interceptor';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule, { logger: ['error', 'warn', 'log', 'debug'] });

  app.setGlobalPrefix('api/v1');

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
  await app.listen(port);
  Logger.log(`agentNews backend listening on :${port}`, 'Bootstrap');
}

void bootstrap();
