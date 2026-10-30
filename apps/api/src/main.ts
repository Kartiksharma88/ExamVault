import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { ExpressAdapter } from '@nestjs/platform-express';
import express, { Express, Request, Response, NextFunction } from 'express';
import cookieParser from 'cookie-parser';
import helmet from 'helmet';
import { HttpExceptionFilter } from './common/exceptions/http-exception.filter';
import { AppModule } from './app.module';

let cachedServer: Express | null = null;

/**
 * Minimal fallback Express app used when NestJS fails to initialize on Vercel.
 * Guarantees the function always responds with JSON instead of a raw
 * "500 / A server error has occurred" (FUNCTION_INVOCATION_FAILED) page.
 */
function buildFallbackServer(reason: string): Express {
  const app = express();
  app.use(cookieParser());
  app.use(
    helmet({
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'self'"],
          scriptSrc: ["'self'"],
          styleSrc: ["'self'", "'unsafe-inline'"],
          connectSrc: ["'self'"],
        },
      },
      crossOriginEmbedderPolicy: false,
    }),
  );
  // CORS (plain Express fallback has no NestJS enableCors)
  app.use((_req: Request, res: Response, next: NextFunction) => {
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Credentials', 'true');
    res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE, OPTIONS');
    res.header('Access-Control-Allow-Headers', 'Content-Type, X-CSRF-Token');
    if (_req.method === 'OPTIONS') {
      res.status(204).end();
      return;
    }
    next();
  });
  app.use(express.json({ limit: '1mb' }));
  app.use(express.urlencoded({ extended: true }));

  // Health endpoint so the deployment can be verified even in fallback mode.
  app.get('/api/health', (_req: Request, res: Response) => {
    res.status(200).json({ status: 'degraded', reason, timestamp: new Date().toISOString() });
  });

  // Catch-all: every other request gets a JSON error (never a raw 500 HTML page).
  app.use((_req: Request, res: Response) => {
    res.status(500).json({
      statusCode: 500,
      error: 'SERVERLESS_INITIALIZATION_ERROR',
      message: `API initialization failed: ${reason}`,
      timestamp: new Date().toISOString(),
      path: _req.url,
    });
  });

  return app;
}

async function bootstrapServer(): Promise<Express> {
  if (cachedServer) {
    return cachedServer;
  }

  try {
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

    // Global exception filter — guarantees a JSON error response instead of a raw 500
    app.useGlobalFilters(new HttpExceptionFilter());

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
  } catch (error: any) {
    // NestJS failed to initialize on this cold start. Do NOT throw — return a
    // fallback Express app so the Vercel function still responds with JSON
    // instead of FUNCTION_INVOCATION_FAILED / "A server error has occurred".
    console.error('NestJS bootstrap failed, falling back to minimal error app:', error?.message);
    cachedServer = buildFallbackServer(error?.message || 'unknown nestjs init error');
    return cachedServer;
  }
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

// bootstrap() — initialises NestJS and returns the Express app.
// Only used for local development; on Vercel the exported `handler` below
// is invoked directly per request.
async function bootstrap(): Promise<Express> {
  if (process.env.VERCEL) {
    return buildFallbackServer('bootstrap disabled on Vercel');
  }
  const server = await bootstrapServer();
  const port = Number(process.env.PORT || process.env.API_PORT || 3001);
  server.listen(port, '0.0.0.0', () => {
    console.log(`ExamVault API running on port ${port}`);
    console.log(`Swagger docs: http://localhost:${port}/api/docs`);
  });
  ;(server as any).on('error', (err: any) => {
    console.error('Server listen error:', err?.message);
  });
  return server;
}

// Start local dev server only when not on Vercel.
if (!process.env.VERCEL) {
  bootstrap().catch((err) => {
    console.error('Fatal bootstrap error:', err);
  });
}
