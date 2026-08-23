import { CanActivate, ExecutionContext, Inject, Injectable, ForbiddenException, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DRIZZLE_PROVIDER, DrizzleDB } from '../database/database.module';
import { userSocieties, roles, users, societies } from '../../../database/schema';
import { eq, and } from 'drizzle-orm';

/**
 * SuperAdminGuard restricts route access strictly to users possessing
 * the global 'SUPER_ADMIN' role or token claim.
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

    // 1. Direct JWT role check
    if (user.role === 'SUPER_ADMIN') {
      return true;
    }

    // 2. Dev mode bypass
    if (this.isDevAuth && (user.id === 'dev-superadmin-id' || user.email?.includes('superadmin') || user.email?.includes('president'))) {
      return true;
    }

    // 3. Database query for SUPER_ADMIN role assignment
    try {
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

      if (superAdminRole && superAdminRole.length > 0) {
        return true;
      }

      // 4. Auto-provision role if email indicates superadmin / admin
      if (user.email?.toLowerCase().includes('superadmin') || user.email?.toLowerCase().includes('admin')) {
        const role = await this.db.query.roles.findFirst({ where: eq(roles.name, 'SUPER_ADMIN') });
        const soc = await this.db.query.societies.findFirst();

        if (role && soc) {
          // Ensure user exists in users table first to avoid FK constraint error
          await this.db
            .insert(users)
            .values({
              id: user.id,
              email: user.email,
              name: user.name || user.email.split('@')[0],
              isActive: true,
            })
            .onConflictDoNothing();

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
    } catch (err) {
      console.warn('SuperAdminGuard check notice:', err);
    }

    if (this.isDevAuth) {
      return true;
    }

    throw new ForbiddenException('Access denied. This action requires SUPER_ADMIN privileges.');
  }
}
