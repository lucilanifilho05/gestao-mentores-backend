import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import cookieParser = require('cookie-parser');

import { ConfigService, } from '@nestjs/config';

import { AllExceptionsFilter, } from './common/filters/all-exceptions.filter';

import { configurarSwagger, } from './config/swagger';

import { AppModule } from './app.module';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule);

  const configService = app.get(ConfigService);
  const corsOrigins = configService
    .getOrThrow<string>('CORS_ORIGINS')
    .split(',')
    .map((origin) => origin.trim().replace(/\/$/, ''))
    .filter(Boolean);

  app.enableCors({
    origin: corsOrigins,
    credentials: true,
  });

  app.use(cookieParser());

  app.enableShutdownHooks();

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: {
        enableImplicitConversion: false,
      },
    }),
  );

  app.useGlobalFilters(
    new AllExceptionsFilter(),
  );

  const swaggerEnabled =
    configService.get<boolean>(
      'SWAGGER_ENABLED',
      false,
    );

  if (swaggerEnabled) {
    configurarSwagger(app);
  }

  const port = process.env.PORT ?? 3000;

  await app.listen(port);
}

void bootstrap();
