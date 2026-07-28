import { Injectable, Inject } from '@nestjs/common';
import { GlobalBaseRepository } from '@core/database/base.repository';
import { users, userSocieties, societies, roles, rolePermissions, permissions } from '../../../database/schema';
import { DRIZZLE_PROVIDER, DrizzleDB } from '@core/database/database.module';
import { eq, and } from 'drizzle-orm';

@Injectable()
export class UserRepository extends GlobalBaseRepository<typeof users> {
  constructor(@Inject(DRIZZLE_PROVIDER) protected readonly db: DrizzleDB) {
    super(db, users);
  }

  /**
   * Retrieves all society memberships and associated roles/permissions for a user.
   */
  async findUserMemberships(userId: string) {
    const records = await this.db
      .select({
        societyId: societies.id,
        societyName: societies.name,
        societySlug: societies.slug,
        roleId: roles.id,
        roleName: roles.name,
        permissionKey: permissions.key,
      })
      .from(userSocieties)
      .innerJoin(societies, eq(userSocieties.societyId, societies.id))
      .innerJoin(roles, eq(userSocieties.roleId, roles.id))
      .leftJoin(rolePermissions, eq(roles.id, rolePermissions.roleId))
      .leftJoin(permissions, eq(rolePermissions.permissionId, permissions.id))
      .where(eq(userSocieties.userId, userId));

    // Group permissions by society for easier frontend resolution
    const membershipsMap: Record<string, {
      societyId: string;
      societyName: string;
      societySlug: string;
      role: string;
      permissions: string[];
    }> = {};

    for (const row of records) {
      if (!membershipsMap[row.societyId]) {
        membershipsMap[row.societyId] = {
          societyId: row.societyId,
          societyName: row.societyName,
          societySlug: row.societySlug,
          role: row.roleName,
          permissions: [],
        };
      }
      if (row.permissionKey) {
        membershipsMap[row.societyId].permissions.push(row.permissionKey);
      }
    }

    return Object.values(membershipsMap);
  }

  /**
   * Find a user by email.
   */
  async findByEmail(email: string) {
    const rows = await this.db
      .select()
      .from(users)
      .where(eq(users.email, email))
      .limit(1);
    return rows[0] || null;
  }

  /**
   * Return all active users (for dev login picker).
   */
  async findAllActive() {
    return this.db
      .select({
        id: users.id,
        email: users.email,
        name: users.name,
        mobile: users.mobile,
        avatarUrl: users.avatarUrl,
      })
      .from(users)
      .where(eq(users.isActive, true));
  }
}
