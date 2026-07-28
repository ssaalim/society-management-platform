import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { AllExceptionsFilter } from '@common/filters/all-exceptions.filter';
import { ResponseInterceptor } from '@common/interceptors/response.interceptor';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { ValidationPipe, VersioningType } from '@nestjs/common';
import helmet from 'helmet';
import * as compression from 'compression';
import * as cookieParser from 'cookie-parser';
import { Logger } from 'nestjs-pino';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, { bufferLogs: true });
  
  // Use Pino Logger
  const logger = app.get(Logger);
  app.useLogger(logger);

  // Enable CORS
  app.enableCors({
    origin: process.env.FRONTEND_URL || 'http://localhost:3000',
    credentials: true,
  });

  // Security Middleware
  app.use(helmet());
  app.use(compression());
  app.use(cookieParser());

  // API Version Prefix
  app.setGlobalPrefix('api');
  app.enableVersioning({
    type: VersioningType.URI,
    defaultVersion: '1',
  });

  // Global Pipes & Filters & Interceptors
  app.useGlobalPipes(new ValidationPipe({ 
    transform: true, 
    whitelist: true,
    forbidNonWhitelisted: true,
    transformOptions: { enableImplicitConversion: true }
  }));
  app.useGlobalInterceptors(new ResponseInterceptor());
  app.useGlobalFilters(new AllExceptionsFilter());

  // Graceful Shutdown Support (Railway/Docker)
  app.enableShutdownHooks();

  // Swagger Documentation (Development only or via config)
  if (process.env.NODE_ENV !== 'production' || process.env.ENABLE_SWAGGER === 'true') {
    const config = new DocumentBuilder()
      .setTitle('Society Management Platform API')
      .setDescription('Production-grade Multi-Tenant Society Management API for India')
      .setVersion('1.0')
      .addBearerAuth()
      .build();
    const document = SwaggerModule.createDocument(app, config);
    SwaggerModule.setup('api/docs', app, document);
  }

  const port = process.env.PORT || 4000;
  const host = process.env.HOST || '0.0.0.0';
  await app.listen(port, host);
  logger.log(`Backend Server running on http://${host}:${port}`);
}
bootstrap();
