import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { ClsServiceManager } from 'nestjs-cls';

/**
 * Decorator to easily extract the current authenticated user ID from the ClsService context.
 * Requires an authentication guard/middleware to have set 'userId' in the context.
 */
export const CurrentUser = createParamDecorator(
  (data: unknown, ctx: ExecutionContext) => {
    const cls = ClsServiceManager.getClsService();
    return cls.get('userId');
  },
);
