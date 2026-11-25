import { NestFactory } from '@nestjs/core';
import { NestExpressApplication } from '@nestjs/platform-express';
import { LOCAL_UPLOAD_ROOT } from '@core/storage/local-upload.controller';
import { AppModule } from './app.module';
import { AllExceptionsFilter } from '@common/filters/all-exceptions.filter';
import { ResponseInterceptor } from '@common/interceptors/response.interceptor';
import { ErrorLogService } from '@core/errors/error-log.service';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { ValidationPipe, VersioningType } from '@nestjs/common';
import helmet from 'helmet';
import * as compression from 'compression';
import * as cookieParser from 'cookie-parser';
import { Logger } from 'nestjs-pino';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule, { bufferLogs: true, rawBody: true });
  
  // Use Pino Logger
  const logger = app.get(Logger);
  app.useLogger(logger);

  // Enable CORS
  app.enableCors({
    origin: true, // Automatically reflect request origin (supports Vercel production and preview deployments)
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: [
      'Origin',
      'X-Requested-With',
      'Content-Type',
      'Accept',
      'Authorization',
      'x-tenant-id',
      'x-dev-user-id',
      'x-webhook-signature',
      'x-razorpay-signature',
      'x-request-id',
    ],
  });

  // Security Middleware
  app.use(helmet({
    crossOriginResourcePolicy: { policy: 'cross-origin' },
    crossOriginEmbedderPolicy: false,
    contentSecurityPolicy: false, // API server returns JSON, disable CSP to prevent blocking client requests
    hsts: {
      maxAge: 31536000,
      includeSubDomains: true,
      preload: true,
    },
  }));
  // Live streams (chat) must not be compressed: compression buffers them and messages would arrive late.
  app.use(
    compression({
      filter: (req: any, res: any) =>
        !String(req.headers.accept || '').includes('text/event-stream') && !String(req.url || '').endsWith('/chat/stream') && compression.filter(req, res),
    }),
  );

  // Local development file storage (used only when Cloudflare R2 is not configured).
  if (process.env.NODE_ENV !== 'production') {
    app.useStaticAssets(LOCAL_UPLOAD_ROOT, { prefix: '/uploads/', index: false, dotfiles: 'deny' });
  }
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
  app.useGlobalFilters(new AllExceptionsFilter(app.get(ErrorLogService)));

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
