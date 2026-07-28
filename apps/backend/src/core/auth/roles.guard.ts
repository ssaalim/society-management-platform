import { CanActivate, ExecutionContext, Inject, Injectable, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ConfigService } from '@nestjs/config';
import { ClsService } from 'nestjs-cls';
import { DRIZZLE_PROVIDER, DrizzleDB } from '../database/database.module';
import { PERMISSIONS_KEY } from './permissions.decorator';
import { userSocieties, roles, rolePermissions, permissions } from '../../../database/schema';
import { eq, and } from 'drizzle-orm';

/**
 * RolesGuard enforces Permission-Based Access Control inside the active tenant (society).
 * Resolves user permissions associated with their role inside the selected society.
 */
@Injectable()
export class RolesGuard implements CanActivate {
  private isDevAuth: boolean;

  constructor(
    private readonly reflector: Reflector,
    private readonly cls: ClsService,
    private readonly configService: ConfigService,
    @Inject(DRIZZLE_PROVIDER) private readonly db: DrizzleDB,
  ) {
    this.isDevAuth = this.configService.get<string>('DEV_AUTH') === 'true';
  }

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const requiredPermissions = this.reflector.getAllAndOverride<string[]>(
      PERMISSIONS_KEY,
      [context.getHandler(), context.getClass()],
    );

    // If no permission metadata is set, route is allowed by default (authentication guards still apply)
    if (!requiredPermissions || requiredPermissions.length === 0) {
      return true;
    }

    const request = context.switchToHttp().getRequest();
    const user = request.user;
    const tenantId = this.cls.get<string>('tenantId');

    if (!user || !tenantId) {
      throw new ForbiddenException('Authentication or tenant context missing.');
    }

    // 1. Query user's assigned role in active society
    const userRolesQuery = await this.db
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
      );

    const roleNames = userRolesQuery.map((r) => r.roleName);

    // Super Admin & Society Management Roles bypass explicit permission checks
    const isManagement = roleNames.some((role) => 
      ['SUPER_ADMIN', 'PRESIDENT', 'SECRETARY', 'TREASURER', 'ACCOUNTANT', 'COMMITTEE_MEMBER', 'SOCIETY_ADMIN'].includes(role)
    );

    if (isManagement) {
      return true;
    }

    // In DEV_AUTH mode, if user is authenticated with a dev token, permit management actions
    if (this.isDevAuth) {
      return true;
    }

    // 2. Query explicit permissions for the role
    const userPermissionsQuery = await this.db
      .select({
        permissionKey: permissions.key,
      })
      .from(userSocieties)
      .innerJoin(roles, eq(userSocieties.roleId, roles.id))
      .innerJoin(rolePermissions, eq(roles.id, rolePermissions.roleId))
      .innerJoin(permissions, eq(rolePermissions.permissionId, permissions.id))
      .where(
        and(
          eq(userSocieties.userId, user.id),
          eq(userSocieties.societyId, tenantId),
        ),
      );

    const userPermissions = userPermissionsQuery.map((item) => item.permissionKey);

    // Validate that all required permissions are present
    const hasPermission = requiredPermissions.every((perm) => userPermissions.includes(perm));

    if (!hasPermission) {
      throw new ForbiddenException('You do not have the required permissions to perform this action.');
    }

    return true;
  }
}
