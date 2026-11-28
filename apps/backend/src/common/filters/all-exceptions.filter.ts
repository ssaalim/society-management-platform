import { ExceptionFilter, Catch, ArgumentsHost, HttpException, HttpStatus, Logger } from '@nestjs/common';
import { Response } from 'express';
import { ZodError } from 'zod';
import { ClsServiceManager } from 'nestjs-cls';
import { ErrorLogService } from '@core/errors/error-log.service';
import { classifyError } from '@core/errors/error-catalog';

/**
 * Turns every error into the API's error shape. Expected problems (validation, permissions, "already paid") keep their
 * message and are not stored. Unexpected faults (5xx) get a stable code (E-1A2B), are saved to the error log grouped by
 * code, and the response carries the code, the request id and plain-language help, so the app can show a popup the
 * user can share with support.
 */
@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger('AllExceptionsFilter');

  constructor(private readonly errorLog?: ErrorLogService) {}

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest();
    const cls = ClsServiceManager.getClsService();
    const requestId = cls?.getId() || 'UNKNOWN';
    const isProduction = process.env.NODE_ENV === 'production';

    let status = HttpStatus.INTERNAL_SERVER_ERROR;
    let message = 'Internal server error';
    let realMessage = '';
    let errors: any[] = [];

    if (exception instanceof HttpException) {
      status = exception.getStatus();
      const resContent: any = exception.getResponse();
      message = typeof resContent === 'object' ? resContent.message || exception.message : resContent;
      if (Array.isArray(resContent?.message)) {
        errors = resContent.message;
        message = resContent.message.join(' ');
      } else if (resContent && Array.isArray(resContent.conflicts)) {
        // Structured conflicts (e.g. flats already billed for a period) reach the client as errors.
        errors = resContent.conflicts;
      }
      realMessage = String(message);
    } else if (exception instanceof ZodError) {
      status = HttpStatus.BAD_REQUEST;
      message = 'Validation failed';
      errors = exception.errors.map((err) => ({ path: err.path.join('.'), message: err.message }));
      realMessage = message;
    } else if (exception instanceof Error) {
      realMessage = exception.message;
      // Database and server details stay on the server in production.
      message = isProduction ? 'Something went wrong on our side.' : exception.message;
    } else {
      realMessage = JSON.stringify(exception) || 'Unknown exception';
      message = isProduction ? 'Something went wrong on our side.' : 'Unknown exception occurred.';
    }

    const body: Record<string, any> = { success: false, message, errors, requestId, statusCode: status };

    if (status >= 500) {
      const where = `${request.method} ${request.route?.path || String(request.url).split('?')[0]}`;
      const code = this.errorLog?.codeFor(realMessage, where) || 'E-0000';
      const known = classifyError(realMessage);
      body.errorCode = code;
      if (known) body.help = { id: known.id, title: known.title, cause: known.cause, steps: known.steps, fixedBy: known.fixedBy };
      this.logger.error(
        `${code} [${requestId}] ${where}: ${realMessage}`,
        exception instanceof Error ? exception.stack : undefined,
      );
      // Saved in the background: the user gets their answer without waiting for the log.
      void this.errorLog?.record({
        source: 'SERVER',
        level: 'error',
        code,
        message: realMessage,
        where,
        stack: exception instanceof Error ? exception.stack : null,
        requestId,
        userId: request.user?.id || null,
        societyId: cls?.get?.('tenantId') || null,
        userAgent: request.headers?.['user-agent'] || null,
        context: { status, query: request.query && Object.keys(request.query).length ? request.query : undefined },
      });
    }

    response.status(status).json(body);
  }
}
