import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { ClsService } from 'nestjs-cls';

/**
 * For routes shaped /societies/:id/...: the society in the path must be the society the TenantGuard verified for
 * this request. Without it, a member of society A could send x-tenant-id=A and act on /societies/B.
 * Must run after TenantGuard.
 */
@Injectable()
export class SocietyParamGuard implements CanActivate {
  constructor(private readonly cls: ClsService) {}

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();
    const tenantId = this.cls.get<string>('tenantId');
    const pathId = request.params?.id;
    if (!tenantId || !pathId || pathId.toLowerCase() !== tenantId.toLowerCase()) {
      throw new ForbiddenException('You can only access the society you are signed in to.');
    }
    return true;
  }
}
