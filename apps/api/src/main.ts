import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { ExpressAdapter } from '@nestjs/platform-express';
import express, { Express, Request, Response } from 'express';
import cookieParser from 'cookie-parser';
import helmet from 'helmet';
import { AppModule } from './app.module';

let cachedServer: Express | null = null;

async function bootstrapServer(): Promise<Express> {
  if (cachedServer) {
    return cachedServer;
  }

  const expressApp = express();
  const app = await NestFactory.create(AppModule, new ExpressAdapter(expressApp), {
    logger: ['error', 'warn', 'log'],
  });

  // Security headers
  app.use(
    helmet({
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'self'"],
          scriptSrc: ["'self'"],
          styleSrc: ["'self'", "'unsafe-inline'", 'https://fonts.googleapis.com'],
          fontSrc: ["'self'", 'https://fonts.gstatic.com'],
          imgSrc: ["'self'", 'data:', 'blob:'],
          connectSrc: ["'self'"],
        },
      },
      crossOriginEmbedderPolicy: false,
    }),
  );

  // Cookie parsing
  app.use(cookieParser());

  // CORS
  app.enableCors({
    origin: (origin, callback) => {
      if (!origin || origin.includes('localhost') || origin.includes('.vercel.app') || origin === process.env.CORS_ORIGIN) {
        return callback(null, true);
      }
      return callback(null, true);
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'],
    allowedHeaders: ['Content-Type', 'X-CSRF-Token'],
  });

  // Global prefix
  app.setGlobalPrefix('api');

  // Global validation pipe
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  // OpenAPI / Swagger
  const config = new DocumentBuilder()
    .setTitle('ExamVault API')
    .setDescription('Secure Examination Paper Generation Framework — Step 1: Question Bank')
    .setVersion('0.1.0')
    .addCookieAuth('examvault_session')
    .addApiKey({ type: 'apiKey', name: 'X-CSRF-Token', in: 'header' }, 'csrf')
    .build();

  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api/docs', app, document);

  await app.init();
  cachedServer = expressApp;
  return cachedServer;
}

// Export default serverless handler for Vercel
export default async function handler(req: Request, res: Response) {
  try {
    const server = await bootstrapServer();
    return server(req, res);
  } catch (error: any) {
    console.error('FATAL Serverless Handler Error:', error);
    return res.status(500).json({
      error: 'SERVERLESS_INITIALIZATION_ERROR',
      message: error?.message || 'Server initialization failed',
      stack: process.env.NODE_ENV === 'production' ? undefined : error?.stack,
    });
  }
}

// Standalone server for local development and non-serverless runtime
async function bootstrap() {
  const server = await bootstrapServer();
  const port = Number(process.env.PORT || process.env.API_PORT || 3001);
  try {
    server.listen(port, '0.0.0.0', () => {
      console.log(`ExamVault API running on port ${port}`);
      console.log(`Swagger docs: http://localhost:${port}/api/docs`);
    });
  } catch (err) {
    console.warn('Server listen warning:', err);
  }
}

if (!process.env.VERCEL) {
  bootstrap();
}
