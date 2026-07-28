import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { ClsServiceManager } from 'nestjs-cls';

/**
 * Decorator to easily extract the current tenant ID from the ClsService context.
 * Automatically resolved from request headers during ClsModule setup.
 */
export const CurrentTenant = createParamDecorator(
  (data: unknown, ctx: ExecutionContext) => {
    const cls = ClsServiceManager.getClsService();
    return cls.get('tenantId');
  },
);
