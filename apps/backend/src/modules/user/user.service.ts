import { Injectable, NotFoundException, Inject, BadRequestException, UnauthorizedException } from '@nestjs/common';
import { UserRepository } from './user.repository';
import { DRIZZLE_PROVIDER, DrizzleDB } from '@core/database/database.module';
import { 
  users, 
  userSocieties, 
  roles, 
  societies, 
  owners, 
  flatOwners, 
  tenants, 
  flatTenants, 
  flats, 
  auditLogs 
} from '../../../database/schema';
import { eq, and, desc } from 'drizzle-orm';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcryptjs';

@Injectable()
export class UserService {
  constructor(
    private readonly userRepository: UserRepository,
    @Inject(DRIZZLE_PROVIDER) private readonly db: DrizzleDB,
    private readonly configService: ConfigService,
  ) {}

  /**
   * Syncs / upserts a user profile.
   */
  async syncUser(data: { id: string; email: string; name?: string; mobile?: string; avatarUrl?: string }) {
    const existing = await this.userRepository.findById(data.id);
    if (existing) {
      return this.userRepository.update(data.id, {
        name: data.name ?? existing.name,
        mobile: data.mobile ?? existing.mobile,
        avatarUrl: data.avatarUrl ?? existing.avatarUrl,
        updatedAt: new Date(),
      });
    }

    const byEmail = await this.userRepository.findByEmail(data.email);
    if (byEmail) {
      return this.userRepository.update(byEmail.id, {
        name: data.name ?? byEmail.name,
        mobile: data.mobile ?? byEmail.mobile,
        avatarUrl: data.avatarUrl ?? byEmail.avatarUrl,
        updatedAt: new Date(),
      });
    }

    return this.userRepository.insert({
      id: data.id,
      email: data.email,
      name: data.name || null,
      mobile: data.mobile || null,
      avatarUrl: data.avatarUrl || null,
    });
  }

  /**
   * Updates user profile (name, mobile).
   */
  async updateProfile(userId: string, data: { name?: string; mobile?: string }) {
    const existing = await this.userRepository.findById(userId);
    if (!existing) {
      throw new NotFoundException('User not found.');
    }
    const updateData: any = { updatedAt: new Date() };
    if (data.name !== undefined) updateData.name = data.name.trim();
    if (data.mobile !== undefined) updateData.mobile = data.mobile.trim();

    return this.userRepository.update(userId, updateData);
  }

  /**
   * Changes user password directly in Neon database with bcrypt.
   */
  async changePassword(userId: string, newPassword: string) {
    if (!newPassword || newPassword.length < 6) {
      throw new BadRequestException('Password must be at least 6 characters long.');
    }

    const existing = await this.userRepository.findById(userId);
    if (!existing) {
      throw new NotFoundException('User not found.');
    }

    const hashedPassword = await bcrypt.hash(newPassword, 10);
    await this.db.update(users).set({
      password: hashedPassword,
      updatedAt: new Date(),
    }).where(eq(users.id, userId));

    return { success: true, message: 'Password updated successfully.' };
  }

  /**
   * The signed-in user's profile and the societies they belong to. Nothing is created here: a user sees only
   * societies a society admin added them to, and platform admins (users.is_platform_admin) are not members of any.
   */
  async getUserMemberships(userId: string) {
    const user = await this.userRepository.findById(userId);
    if (!user || !user.isActive) {
      throw new UnauthorizedException('Account not found or deactivated.');
    }
    const memberships = await this.userRepository.findUserMemberships(userId);
    return {
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        mobile: user.mobile,
        avatarUrl: user.avatarUrl,
        defaultSocietyId: user.defaultSocietyId,
        isPlatformAdmin: user.isPlatformAdmin,
      },
      memberships,
    };
  }

  async setDefaultSociety(userId: string, societyId: string) {
    const isMember = await this.db.query.userSocieties.findFirst({
      where: and(
        eq(userSocieties.userId, userId),
        eq(userSocieties.societyId, societyId),
      ),
    });

    if (!isMember) {
      throw new NotFoundException('You are not a registered member of this society.');
    }

    await this.userRepository.update(userId, { defaultSocietyId: societyId });
    return { success: true, defaultSocietyId: societyId };
  }

  async findByEmail(email: string) {
    return this.userRepository.findByEmail(email);
  }

  // ==========================================
  // SOCIETY USERS & ACCESS CONTROL
  // ==========================================

  async getSocietyUsers(societyId: string) {
    const list = await this.db
      .select({
        id: users.id,
        // The members page reads the account id as userId (role change, revoke, app invite).
        userId: users.id,
        name: users.name,
        email: users.email,
        mobile: users.mobile,
        avatarUrl: users.avatarUrl,
        isActive: users.isActive,
        roleId: roles.id,
        roleName: roles.name,
        roleDescription: roles.description,
        userSocietyId: userSocieties.id,
        joinedAt: userSocieties.createdAt,
        createdAt: userSocieties.createdAt,
      })
      .from(userSocieties)
      .innerJoin(users, eq(userSocieties.userId, users.id))
      .innerJoin(roles, eq(userSocieties.roleId, roles.id))
      .where(eq(userSocieties.societyId, societyId))
      .orderBy(desc(userSocieties.createdAt));

    return list;
  }

  async grantUserAccess(
    societyId: string,
    dto: {
      email: string;
      roleName: string;
      name?: string;
      mobile?: string;
      password?: string;
    },
    executorId?: string,
  ) {
    if (!dto.email || !dto.roleName) {
      throw new BadRequestException('Email and system role are required.');
    }

    const email = dto.email.trim().toLowerCase();
    const roleName = dto.roleName.trim().toUpperCase();

    // 1. Resolve or create user in database
    let userRecord = await this.userRepository.findByEmail(email);
    let resolvedUserId = userRecord?.id;

    if (!resolvedUserId) {
      resolvedUserId = require('crypto').randomUUID();
      const hashedPassword = await bcrypt.hash(dto.password || 'password123', 10);

      const inserted = await this.db.insert(users).values({
        id: resolvedUserId,
        email,
        password: hashedPassword,
        name: dto.name?.trim() || null,
        mobile: dto.mobile?.trim() || null,
        defaultSocietyId: societyId,
      }).returning();
      userRecord = inserted[0];
    } else {
      // Update name/mobile if provided
      if (dto.name || dto.mobile) {
        await this.db.update(users).set({
          name: dto.name ? dto.name.trim() : userRecord.name,
          mobile: dto.mobile ? dto.mobile.trim() : userRecord.mobile,
          updatedAt: new Date(),
        }).where(eq(users.id, resolvedUserId));
      }
    }

    // 2. Resolve Role
    let roleRecord = await this.db.query.roles.findFirst({
      where: eq(roles.name, roleName),
    });

    if (!roleRecord) {
      const insertedRoles = await this.db.insert(roles).values({
        id: require('crypto').randomUUID(),
        name: roleName,
        description: `Role for ${roleName}`,
      }).returning();
      roleRecord = insertedRoles[0];
    }

    // 3. Check existing membership in this society
    const existingMembership = await this.db.query.userSocieties.findFirst({
      where: and(
        eq(userSocieties.userId, resolvedUserId),
        eq(userSocieties.societyId, societyId),
      ),
    });

    if (existingMembership) {
      await this.db.update(userSocieties).set({
        roleId: roleRecord.id,
        updatedAt: new Date(),
      }).where(eq(userSocieties.id, existingMembership.id));
    } else {
      await this.db.insert(userSocieties).values({
        id: require('crypto').randomUUID(),
        userId: resolvedUserId,
        societyId,
        roleId: roleRecord.id,
      });
    }

    // 4. Audit Log
    try {
      await this.db.insert(auditLogs).values({
        societyId,
        userId: executorId || null,
        action: 'GRANT_USER_ACCESS',
        entityName: 'user_societies',
        entityId: resolvedUserId,
        newValues: { email, role: roleName },
      });
    } catch {}

    return {
      success: true,
      message: `Access successfully granted to ${email} as ${roleName}.`,
      user: userRecord,
      role: roleRecord,
    };
  }

  async updateUserRole(societyId: string, userId: string, dto: { roleName: string }, executorId?: string) {
    if (!dto.roleName) {
      throw new BadRequestException('Role name is required.');
    }

    const roleName = dto.roleName.trim().toUpperCase();
    let roleRecord = await this.db.query.roles.findFirst({
      where: eq(roles.name, roleName),
    });

    if (!roleRecord) {
      const insertedRoles = await this.db.insert(roles).values({
        id: require('crypto').randomUUID(),
        name: roleName,
        description: `Role for ${roleName}`,
      }).returning();
      roleRecord = insertedRoles[0];
    }

    const membership = await this.db.query.userSocieties.findFirst({
      where: and(
        eq(userSocieties.userId, userId),
        eq(userSocieties.societyId, societyId),
      ),
    });

    if (!membership) {
      throw new NotFoundException('User is not assigned to this society.');
    }

    await this.db.update(userSocieties).set({
      roleId: roleRecord.id,
      updatedAt: new Date(),
    }).where(eq(userSocieties.id, membership.id));

    try {
      await this.db.insert(auditLogs).values({
        societyId,
        userId: executorId || null,
        action: 'UPDATE_USER_ROLE',
        entityName: 'user_societies',
        entityId: userId,
        newValues: { role: roleName },
      });
    } catch {}

    return { success: true, message: `User role updated to ${roleName}.` };
  }

  async revokeUserAccess(societyId: string, userId: string, executorId?: string) {
    const membership = await this.db.query.userSocieties.findFirst({
      where: and(
        eq(userSocieties.userId, userId),
        eq(userSocieties.societyId, societyId),
      ),
    });

    if (!membership) {
      throw new NotFoundException('User membership not found.');
    }

    await this.db.delete(userSocieties).where(eq(userSocieties.id, membership.id));

    try {
      await this.db.insert(auditLogs).values({
        societyId,
        userId: executorId || null,
        action: 'REVOKE_USER_ACCESS',
        entityName: 'user_societies',
        entityId: userId,
      });
    } catch {}

    return { success: true, message: 'User access successfully revoked.' };
  }
}
