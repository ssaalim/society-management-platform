import { ExceptionFilter, Catch, ArgumentsHost, HttpException, HttpStatus, Logger } from '@nestjs/common';
import { Response } from 'express';
import { ZodError } from 'zod';
import { ClsServiceManager } from 'nestjs-cls';

@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger('AllExceptionsFilter');

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest();
    const cls = ClsServiceManager.getClsService();
    const requestId = cls?.getId() || 'UNKNOWN';

    let status = HttpStatus.INTERNAL_SERVER_ERROR;
    let message = 'Internal server error';
    let code = 'INTERNAL_SERVER_ERROR';
    let details: any = null;
    let errors: any[] = [];

    if (exception instanceof HttpException) {
      status = exception.getStatus();
      const resContent: any = exception.getResponse();
      message = typeof resContent === 'object' ? resContent.message || exception.message : resContent;
      code = typeof resContent === 'object' ? resContent.error || 'HTTP_EXCEPTION' : 'HTTP_EXCEPTION';
      if (Array.isArray(resContent.message)) {
        errors = resContent.message;
      }
    } else if (exception instanceof ZodError) {
      status = HttpStatus.BAD_REQUEST;
      message = 'Validation failed';
      code = 'VALIDATION_FAILED';
      errors = exception.errors.map((err) => ({
        path: err.path.join('.'),
        message: err.message,
      }));
    } else if (exception instanceof Error) {
      message = exception.message;
      code = exception.name || 'ERROR';

      // Log stack details for troubleshooting server failures
      this.logger.error(`Unhandled Exception [${requestId}] at ${request.method} ${request.url}: ${exception.message}`, exception.stack);
    } else {
      this.logger.error(`Unhandled Unknown Exception [${requestId}] at ${request.method} ${request.url}: ${JSON.stringify(exception)}`);
    }

    if (!errors.length && details) {
        errors = Array.isArray(details) ? details : [details];
    }

    response.status(status).json({
      success: false,
      message,
      errors,
      requestId,
    });
  }
}
