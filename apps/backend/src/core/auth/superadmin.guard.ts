import { CanActivate, ExecutionContext, Inject, Injectable, ForbiddenException, UnauthorizedException } from '@nestjs/common';
import { DRIZZLE_PROVIDER, DrizzleDB } from '../database/database.module';
import { users } from '../../../database/schema';
import { eq } from 'drizzle-orm';

/**
 * SuperAdminGuard protects the platform console API (/superadmin, society create/delete).
 *
 * Access needs both a platform-scoped token (issued only by POST /auth/platform-login) and the user's
 * users.is_platform_admin flag, re-checked on every request so revoking the flag takes effect immediately.
 * There are no email, role-name or development shortcuts.
 */
@Injectable()
export class SuperAdminGuard implements CanActivate {
  constructor(@Inject(DRIZZLE_PROVIDER) private readonly db: DrizzleDB) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const user = request.user;

    if (!user || !user.id) {
      throw new UnauthorizedException('Authentication required for platform operations.');
    }
    if (user.scope !== 'platform') {
      throw new ForbiddenException('Sign in to the platform console to perform this action.');
    }

    const record = await this.db
      .select({ isPlatformAdmin: users.isPlatformAdmin, isActive: users.isActive })
      .from(users)
      .where(eq(users.id, user.id))
      .limit(1);

    if (!record[0]?.isPlatformAdmin || !record[0].isActive) {
      throw new ForbiddenException('Access denied. This action requires a platform administrator.');
    }
    return true;
  }
}
