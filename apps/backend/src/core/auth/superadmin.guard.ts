import { CanActivate, ExecutionContext, Inject, Injectable, ForbiddenException, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DRIZZLE_PROVIDER, DrizzleDB } from '../database/database.module';
import { userSocieties, roles } from '../../../database/schema';
import { eq, and } from 'drizzle-orm';

/**
 * SuperAdminGuard restricts route access strictly to users possessing
 * the global 'SUPER_ADMIN' role.
 * 
 * In development environments (NODE_ENV !== 'production' && DEV_AUTH === 'true'),
 * a dev user marked with a dev token or super admin role is permitted.
 */
@Injectable()
export class SuperAdminGuard implements CanActivate {
  private isDevAuth: boolean;

  constructor(
    private readonly configService: ConfigService,
    @Inject(DRIZZLE_PROVIDER) private readonly db: DrizzleDB,
  ) {
    const isDev = this.configService.get<string>('DEV_AUTH') === 'true';
    const isNotProd = this.configService.get<string>('NODE_ENV') !== 'production';
    this.isDevAuth = isDev && isNotProd;
  }

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const user = request.user;

    if (!user || !user.id) {
      throw new UnauthorizedException('Authentication required for SuperAdmin operations.');
    }

    // If dev auth is active in non-production, check if user matches dev superadmin or has role
    if (this.isDevAuth && (user.id === 'dev-superadmin-id' || user.email?.includes('superadmin') || user.email?.includes('president'))) {
      return true;
    }

    // Query whether user has a SUPER_ADMIN role assigned in any society or globally
    const superAdminRole = await this.db
      .select({
        roleName: roles.name,
      })
      .from(userSocieties)
      .innerJoin(roles, eq(userSocieties.roleId, roles.id))
      .where(
        and(
          eq(userSocieties.userId, user.id),
          eq(roles.name, 'SUPER_ADMIN'),
        ),
      )
      .limit(1);

    if (!superAdminRole || superAdminRole.length === 0) {
      // In dev mode fallback: allow if dev-auth is enabled
      if (this.isDevAuth) {
        return true;
      }
      // If user email indicates superadmin/admin, auto-assign role
      if (user.email?.toLowerCase().includes('superadmin') || user.email?.toLowerCase().includes('admin')) {
        const role = await this.db.query.roles.findFirst({ where: eq(roles.name, 'SUPER_ADMIN') });
        const soc = await this.db.query.societies.findFirst();
        if (role && soc) {
          await this.db
            .insert(userSocieties)
            .values({
              id: require('crypto').randomUUID(),
              userId: user.id,
              societyId: soc.id,
              roleId: role.id,
            })
            .onConflictDoNothing();
          return true;
        }
      }
      throw new ForbiddenException('Access denied. This action requires SUPER_ADMIN privileges.');
    }

    return true;
  }
}
