"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = handler;
require("reflect-metadata");
const core_1 = require("@nestjs/core");
const common_1 = require("@nestjs/common");
const swagger_1 = require("@nestjs/swagger");
const platform_express_1 = require("@nestjs/platform-express");
const express_1 = __importDefault(require("express"));
const cookie_parser_1 = __importDefault(require("cookie-parser"));
const helmet_1 = __importDefault(require("helmet"));
const http_exception_filter_1 = require("./common/exceptions/http-exception.filter");
const app_module_1 = require("./app.module");
let cachedServer = null;
/**
 * Minimal fallback Express app used when NestJS fails to initialize on Vercel.
 * Guarantees the function always responds with JSON instead of a raw
 * "500 / A server error has occurred" (FUNCTION_INVOCATION_FAILED) page.
 */
function buildFallbackServer(reason) {
    const app = (0, express_1.default)();
    app.use((0, cookie_parser_1.default)());
    app.use((0, helmet_1.default)({
        contentSecurityPolicy: {
            directives: {
                defaultSrc: ["'self'"],
                scriptSrc: ["'self'"],
                styleSrc: ["'self'", "'unsafe-inline'"],
                connectSrc: ["'self'"],
            },
        },
        crossOriginEmbedderPolicy: false,
    }));
    // CORS (plain Express fallback has no NestJS enableCors)
    app.use((_req, res, next) => {
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
    app.use(express_1.default.json({ limit: '1mb' }));
    app.use(express_1.default.urlencoded({ extended: true }));
    // Health endpoint so the deployment can be verified even in fallback mode.
    app.get('/api/health', (_req, res) => {
        res.status(200).json({ status: 'degraded', reason, timestamp: new Date().toISOString() });
    });
    // Catch-all: every other request gets a JSON error (never a raw 500 HTML page).
    app.use((_req, res) => {
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
async function bootstrapServer() {
    if (cachedServer) {
        return cachedServer;
    }
    // Hard timeout so NestJS cold-start can never hang the Vercel function.
    const bootstrapTimeout = () => new Promise((_, reject) => setTimeout(() => reject(new Error('NestJS bootstrap timeout (15s)')), 15000));
    try {
        const expressApp = (0, express_1.default)();
        const app = await Promise.race([
            core_1.NestFactory.create(app_module_1.AppModule, new platform_express_1.ExpressAdapter(expressApp), {
                logger: ['error', 'warn', 'log'],
            }),
            bootstrapTimeout(),
        ]);
        // Security headers
        app.use((0, helmet_1.default)({
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
        }));
        // Cookie parsing
        app.use((0, cookie_parser_1.default)());
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
        app.useGlobalPipes(new common_1.ValidationPipe({
            whitelist: true,
            forbidNonWhitelisted: true,
            transform: true,
        }));
        // Global exception filter — guarantees a JSON error response instead of a raw 500
        app.useGlobalFilters(new http_exception_filter_1.HttpExceptionFilter());
        // OpenAPI / Swagger
        const config = new swagger_1.DocumentBuilder()
            .setTitle('ExamVault API')
            .setDescription('Secure Examination Paper Generation Framework — Step 1: Question Bank')
            .setVersion('0.1.0')
            .addCookieAuth('examvault_session')
            .addApiKey({ type: 'apiKey', name: 'X-CSRF-Token', in: 'header' }, 'csrf')
            .build();
        const document = swagger_1.SwaggerModule.createDocument(app, config);
        swagger_1.SwaggerModule.setup('api/docs', app, document);
        // Init with timeout too
        await Promise.race([
            app.init(),
            bootstrapTimeout(),
        ]);
        cachedServer = expressApp;
        return cachedServer;
    }
    catch (error) {
        // NestJS failed to initialize or timed out on this cold start. Do NOT throw —
        // return a fallback Express app so the Vercel function still responds with JSON
        // instead of FUNCTION_INVOCATION_FAILED / "A server error has occurred".
        console.error('NestJS bootstrap failed, falling back to minimal error app:', error?.message);
        cachedServer = buildFallbackServer(error?.message || 'nestjs bootstrap failed');
        return cachedServer;
    }
}
// Export default serverless handler for Vercel
async function handler(req, res) {
    try {
        const server = await bootstrapServer();
        return server(req, res);
    }
    catch (error) {
        console.error('FATAL Serverless Handler Error:', error);
        return res.status(500).json({
            error: 'SERVERLESS_INITIALIZATION_ERROR',
            message: error?.message || 'Server initialization failed',
            stack: process.env.NODE_ENV === 'production' ? undefined : error?.stack,
        });
    }
}
// bootstrap() — initialises NestJS and returns the Express app.
// Vercel's NestJS runtime calls bootstrap() and intercepts the returned
// Express app; do NOT call server.listen() (incompatible with serverless).
async function bootstrap() {
    return await bootstrapServer();
}
//# sourceMappingURL=main.js.map