import { Injectable, Inject } from '@nestjs/common';
import { GlobalBaseRepository } from '@core/database/base.repository';
import { 
  users, 
  userSocieties, 
  societies, 
  roles, 
  rolePermissions, 
  permissions,
  subscriptions,
  plans 
} from '../../../database/schema';
import { DRIZZLE_PROVIDER, DrizzleDB } from '@core/database/database.module';
import { eq, and } from 'drizzle-orm';

@Injectable()
export class UserRepository extends GlobalBaseRepository<typeof users> {
  constructor(@Inject(DRIZZLE_PROVIDER) protected readonly db: DrizzleDB) {
    super(db, users);
  }

  /**
   * Retrieves all society memberships and associated roles/permissions for a user,
   * joined with subscription validity status and default society flag.
   */
  async findUserMemberships(userId: string) {
    const userProfile = await this.findById(userId);

    const records = await this.db
      .select({
        societyId: societies.id,
        societyName: societies.name,
        societySlug: societies.slug,
        roleId: roles.id,
        roleName: roles.name,
        permissionKey: permissions.key,
        subscriptionStatus: subscriptions.status,
        subscriptionEndDate: subscriptions.endDate,
        planName: plans.name,
      })
      .from(userSocieties)
      .innerJoin(societies, eq(userSocieties.societyId, societies.id))
      .innerJoin(roles, eq(userSocieties.roleId, roles.id))
      .leftJoin(rolePermissions, eq(roles.id, rolePermissions.roleId))
      .leftJoin(permissions, eq(rolePermissions.permissionId, permissions.id))
      .leftJoin(subscriptions, eq(societies.id, subscriptions.societyId))
      .leftJoin(plans, eq(subscriptions.planId, plans.id))
      .where(eq(userSocieties.userId, userId));

    const today = new Date(new Date().setHours(0, 0, 0, 0));
    const membershipsMap: Record<string, {
      societyId: string;
      societyName: string;
      societySlug: string;
      role: string;
      permissions: string[];
      subscriptionStatus: string;
      isExpired: boolean;
      planName: string | null;
      endDate: string | null;
      daysLeft: number | null;
      isDefault: boolean;
    }> = {};

    for (const row of records) {
      if (!membershipsMap[row.societyId]) {
        let isExpired = false;
        let daysLeft: number | null = null;
        if (row.subscriptionEndDate) {
          const end = new Date(row.subscriptionEndDate);
          daysLeft = Math.ceil((end.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
          isExpired = row.subscriptionStatus === 'EXPIRED' || daysLeft < 0;
        } else if (row.subscriptionStatus === 'EXPIRED') {
          isExpired = true;
        }

        const effectiveStatus = isExpired ? 'EXPIRED' : (row.subscriptionStatus || 'NO_PLAN');

        membershipsMap[row.societyId] = {
          societyId: row.societyId,
          societyName: row.societyName,
          societySlug: row.societySlug,
          role: row.roleName,
          permissions: [],
          subscriptionStatus: effectiveStatus,
          isExpired,
          planName: row.planName || null,
          endDate: row.subscriptionEndDate || null,
          daysLeft,
          isDefault: userProfile?.defaultSocietyId === row.societyId,
        };
      }
      if (row.permissionKey) {
        membershipsMap[row.societyId].permissions.push(row.permissionKey);
      }
    }

    return Object.values(membershipsMap);
  }

  /**
   * Sets user's default society.
   */
  async setDefaultSociety(userId: string, societyId: string) {
    await this.db
      .update(users)
      .set({
        defaultSocietyId: societyId,
        updatedAt: new Date(),
      })
      .where(eq(users.id, userId));
    return { success: true, defaultSocietyId: societyId };
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
        defaultSocietyId: users.defaultSocietyId,
      })
      .from(users)
      .where(eq(users.isActive, true));
  }
}
