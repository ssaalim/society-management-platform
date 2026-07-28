import { CallHandler, ExecutionContext, Injectable, NestInterceptor } from '@nestjs/common';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { PaginatedResponse } from '@society/shared';

export interface Response<T> {
  success: boolean;
  message: string;
  data: T | null;
  meta?: any;
}

@Injectable()
export class ResponseInterceptor<T> implements NestInterceptor<T, Response<T>> {
  intercept(context: ExecutionContext, next: CallHandler): Observable<Response<T>> {
    return next.handle().pipe(
      map((res) => {
        // If it's a paginated response (has data and meta in a specific format), extract them
        if (res && typeof res === 'object' && 'data' in res && 'meta' in res) {
          return {
            success: true,
            message: res.message || 'Request successful',
            data: res.data,
            meta: res.meta,
          };
        }

        // Standard response
        return {
          success: true,
          message: res?.message || 'Request successful',
          data: res?.data !== undefined ? res.data : res,
          meta: res?.meta || {},
        };
      }),
    );
  }
}
