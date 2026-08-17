import { 
  Injectable, 
  CanActivate, 
  ExecutionContext, 
  BadRequestException, 
  ForbiddenException, 
  Inject, 
  Optional 
} from '@nestjs/common';
import { ClsService } from 'nestjs-cls';
import { DRIZZLE_PROVIDER, DrizzleDB } from '@core/database/database.module';
import { subscriptions } from '../../../database/schema';
import { eq } from 'drizzle-orm';

/**
 * TenantGuard ensures that every tenant-scoped request has a resolved tenant context.
 * It reads the 'x-tenant-id' header from the incoming request, checks subscription validity,
 * and injects the tenant ID into AsyncLocalStorage via CLS.
 */
@Injectable()
export class TenantGuard implements CanActivate {
  constructor(
    private readonly cls: ClsService,
    @Optional() @Inject(DRIZZLE_PROVIDER) private readonly db?: DrizzleDB,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
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

    // Check subscription status if database is available
    if (this.db) {
      const path = request.url || '';
      // Allow reading subscription status route itself so admins/users can see status & banner
      const isSubscriptionStatusRoute = path.includes('/subscription');

      if (!isSubscriptionStatusRoute) {
        try {
          const sub = await this.db.query.subscriptions.findFirst({
            where: eq(subscriptions.societyId, tenantId),
          });

          if (sub) {
            const isExpired = sub.status === 'EXPIRED' || (sub.endDate && new Date(sub.endDate) < new Date(new Date().setHours(0, 0, 0, 0)));
            if (isExpired) {
              throw new ForbiddenException(
                'Your society subscription plan has expired. Please contact your society administrator or platform admin to renew your plan.'
              );
            }
          }
        } catch (err: any) {
          if (err instanceof ForbiddenException) {
            throw err;
          }
          // If query fails for any transient reason, proceed to avoid hard crash
        }
      }
    }

    // Set the resolved tenant context in current CLS state
    this.cls.set('tenantId', tenantId);

    return true;
  }
}
