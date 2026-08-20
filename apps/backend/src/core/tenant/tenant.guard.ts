import { 
  Injectable, 
  CanActivate, 
  ExecutionContext, 
  BadRequestException, 
  ForbiddenException, 
  Inject, 
  Optional 
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ClsService } from 'nestjs-cls';
import { DRIZZLE_PROVIDER, DrizzleDB } from '@core/database/database.module';
import { subscriptions, userSocieties, roles } from '../../../database/schema';
import { eq, and } from 'drizzle-orm';

/**
 * TenantGuard ensures that every tenant-scoped request has a resolved tenant context.
 * It reads the 'x-tenant-id' header, checks subscription validity, ensures the authenticated
 * user actually has access to this tenant, and injects the tenant ID into AsyncLocalStorage via CLS.
 */
@Injectable()
export class TenantGuard implements CanActivate {
  private isDevAuth: boolean;

  constructor(
    private readonly cls: ClsService,
    private readonly configService: ConfigService,
    @Optional() @Inject(DRIZZLE_PROVIDER) private readonly db?: DrizzleDB,
  ) {
    const isDev = this.configService.get<string>('DEV_AUTH') === 'true';
    const isNotProd = this.configService.get<string>('NODE_ENV') !== 'production';
    this.isDevAuth = isDev && isNotProd;
  }

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

    // Check database constraints
    if (this.db) {
      const user = request.user;

      // 1. If user is authenticated, ensure they belong to this society (unless SuperAdmin)
      if (user && user.id && !this.isDevAuth) {
        const membership = await this.db
          .select({
            roleName: roles.name,
          })
          .from(userSocieties)
          .innerJoin(roles, eq(userSocieties.roleId, roles.id))
          .where(
            and(
              eq(userSocieties.userId, user.id),
              eq(userSocieties.societyId, tenantId),
            ),
          )
          .limit(1);

        if (!membership || membership.length === 0) {
          // Check if user is a global SuperAdmin
          const isGlobalSuperAdmin = await this.db
            .select({ id: userSocieties.id })
            .from(userSocieties)
            .innerJoin(roles, eq(userSocieties.roleId, roles.id))
            .where(
              and(
                eq(userSocieties.userId, user.id),
                eq(roles.name, 'SUPER_ADMIN'),
              ),
            )
            .limit(1);

          if (!isGlobalSuperAdmin || isGlobalSuperAdmin.length === 0) {
            throw new ForbiddenException('You do not have access to this society workspace.');
          }
        }
      }

      // 2. Check subscription status
      const path = request.url || '';
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
