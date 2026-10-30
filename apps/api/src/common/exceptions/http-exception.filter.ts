import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Request, Response } from 'express';

/**
 * HttpExceptionFilter — Global safety net.
 *
 * Catches every unhandled exception thrown anywhere in the NestJS application
 * and guarantees a JSON error response with a proper status code. This ensures
 * the deployed API never returns a raw "500 / A server error has occurred"
 * (Vercel FUNCTION_INVOCATION_FAILED) page — clients always receive a parseable
 * error body they can surface to the user instead.
 */
@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(HttpExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    let status: number;
    let message: string;
    let errorCode: string;

    if (exception instanceof HttpException) {
      status = exception.getStatus();
      const responseBody = exception.getResponse();
      message =
        typeof responseBody === 'string'
          ? responseBody
          : (responseBody as any)?.message || exception.message;
      errorCode = (responseBody as any)?.error || exception.constructor.name;
    } else if (exception instanceof Error) {
      status = HttpStatus.INTERNAL_SERVER_ERROR;
      message = exception.message;
      errorCode = exception.constructor.name;
      // Log the full stack for server-side diagnostics, never leak it to the client.
      this.logger.error(
        `Unhandled exception on ${request.method} ${request.url}: ${exception.stack}`,
      );
    } else {
      status = HttpStatus.INTERNAL_SERVER_ERROR;
      message = 'Internal server error';
      errorCode = 'INTERNAL_SERVER_ERROR';
      this.logger.error(
        `Unhandled unknown exception on ${request.method} ${request.url}: ${String(exception)}`,
      );
    }

    response.status(status).json({
      statusCode: status,
      error: errorCode,
      message,
      timestamp: new Date().toISOString(),
      path: request.url,
    });
  }
}
