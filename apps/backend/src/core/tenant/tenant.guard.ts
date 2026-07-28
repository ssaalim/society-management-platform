import { Injectable, CanActivate, ExecutionContext, BadRequestException } from '@nestjs/common';
import { ClsService } from 'nestjs-cls';

/**
 * TenantGuard ensures that every tenant-scoped request has a resolved tenant context.
 * It reads the 'x-tenant-id' header from the incoming request and injects it into AsyncLocalStorage.
 */
@Injectable()
export class TenantGuard implements CanActivate {
  constructor(private readonly cls: ClsService) {}

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();
    const tenantId = request.headers['x-tenant-id'];

    if (!tenantId) {
      throw new BadRequestException('Missing x-tenant-id header. This endpoint requires tenant context isolation.');
    }

    // Ensure the tenant ID matches UUID format to prevent injection attacks
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(tenantId)) {
      throw new BadRequestException('Invalid x-tenant-id header format. Must be a valid UUIDv4.');
    }

    // Set the resolved tenant context in current CLS state
    this.cls.set('tenantId', tenantId);

    return true;
  }
}
