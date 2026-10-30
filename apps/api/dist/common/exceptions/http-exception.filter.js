"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var HttpExceptionFilter_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.HttpExceptionFilter = void 0;
const common_1 = require("@nestjs/common");
/**
 * HttpExceptionFilter — Global safety net.
 *
 * Catches every unhandled exception thrown anywhere in the NestJS application
 * and guarantees a JSON error response with a proper status code. This ensures
 * the deployed API never returns a raw "500 / A server error has occurred"
 * (Vercel FUNCTION_INVOCATION_FAILED) page — clients always receive a parseable
 * error body they can surface to the user instead.
 */
let HttpExceptionFilter = HttpExceptionFilter_1 = class HttpExceptionFilter {
    logger = new common_1.Logger(HttpExceptionFilter_1.name);
    catch(exception, host) {
        const ctx = host.switchToHttp();
        const response = ctx.getResponse();
        const request = ctx.getRequest();
        let status;
        let message;
        let errorCode;
        if (exception instanceof common_1.HttpException) {
            status = exception.getStatus();
            const responseBody = exception.getResponse();
            message =
                typeof responseBody === 'string'
                    ? responseBody
                    : responseBody?.message || exception.message;
            errorCode = responseBody?.error || exception.constructor.name;
        }
        else if (exception instanceof Error) {
            status = common_1.HttpStatus.INTERNAL_SERVER_ERROR;
            message = exception.message;
            errorCode = exception.constructor.name;
            // Log the full stack for server-side diagnostics, never leak it to the client.
            this.logger.error(`Unhandled exception on ${request.method} ${request.url}: ${exception.stack}`);
        }
        else {
            status = common_1.HttpStatus.INTERNAL_SERVER_ERROR;
            message = 'Internal server error';
            errorCode = 'INTERNAL_SERVER_ERROR';
            this.logger.error(`Unhandled unknown exception on ${request.method} ${request.url}: ${String(exception)}`);
        }
        response.status(status).json({
            statusCode: status,
            error: errorCode,
            message,
            timestamp: new Date().toISOString(),
            path: request.url,
        });
    }
};
exports.HttpExceptionFilter = HttpExceptionFilter;
exports.HttpExceptionFilter = HttpExceptionFilter = HttpExceptionFilter_1 = __decorate([
    (0, common_1.Catch)()
], HttpExceptionFilter);
//# sourceMappingURL=http-exception.filter.js.map