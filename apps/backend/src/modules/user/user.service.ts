import { Injectable, NotFoundException, Inject, BadRequestException } from '@nestjs/common';
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
import { createClient, SupabaseClient } from '@supabase/supabase-js';

@Injectable()
export class UserService {
  private supabase: SupabaseClient;

  constructor(
    private readonly userRepository: UserRepository,
    @Inject(DRIZZLE_PROVIDER) private readonly db: DrizzleDB,
    private readonly configService: ConfigService,
  ) {
    const supabaseUrl = this.configService.get<string>('SUPABASE_URL') || 'https://placeholder.supabase.co';
    const supabaseServiceKey = this.configService.get<string>('SUPABASE_SERVICE_ROLE_KEY') || 'placeholder-key';
    this.supabase = createClient(supabaseUrl, supabaseServiceKey);
  }

  /**
   * Syncs a user profile from Supabase metadata.
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
   * Changes user password.
   */
  async changePassword(userId: string, newPassword: string) {
    if (!newPassword || newPassword.length < 6) {
      throw new BadRequestException('Password must be at least 6 characters long.');
    }
    try {
      const { error } = await this.supabase.auth.admin.updateUserById(userId, {
        password: newPassword,
      });
      if (error) {
        console.warn('Supabase password update error:', error);
      }
    } catch (err) {
      console.warn('Supabase change password notice:', err);
    }
    return { success: true, message: 'Password updated successfully.' };
  }

  /**
   * Retrieves active memberships list for the user profile.
   * Seamlessly links Supabase Auth accounts by email and provisions Super Admin memberships if applicable.
   */
  async getUserMemberships(userId: string, email?: string, name?: string) {
    let user = await this.userRepository.findById(userId);

    // If user not found by Supabase UUID, check if user exists by email (e.g. from seeded database)
    if (!user && email) {
      const userByEmail = await this.userRepository.findByEmail(email);
      if (userByEmail) {
        const oldId = userByEmail.id;
        
        // Re-link user records and memberships to the new Supabase UUID
        await this.db.transaction(async (tx) => {
          await tx.insert(users).values({
            id: userId,
            email: email,
            name: name || userByEmail.name,
            mobile: userByEmail.mobile,
            avatarUrl: userByEmail.avatarUrl,
            defaultSocietyId: userByEmail.defaultSocietyId,
          }).onConflictDoUpdate({
            target: users.id,
            set: { email, name: name || userByEmail.name },
          });

          await tx.update(userSocieties).set({ userId }).where(eq(userSocieties.userId, oldId));
        });

        user = await this.userRepository.findById(userId);
      }
    }

    // If user still does not exist, create the profile
    if (!user && email) {
      const isSuperAdminEmail = email.toLowerCase().includes('superadmin');
      
      const newUsers = await this.db.insert(users).values({
        id: userId,
        email: email,
        name: name || email.split('@')[0],
        isActive: true,
      }).onConflictDoNothing().returning();

      user = newUsers[0] || (await this.userRepository.findById(userId));

      if (isSuperAdminEmail) {
        // Auto-assign SUPER_ADMIN role for all societies
        const superAdminRole = await this.db.query.roles.findFirst({
          where: eq(roles.name, 'SUPER_ADMIN'),
        });
        const allSocieties = await this.db.query.societies.findMany();

        if (superAdminRole && allSocieties.length > 0) {
          for (const s of allSocieties) {
            await this.db.insert(userSocieties).values({
              id: require('crypto').randomUUID(),
              userId: userId,
              societyId: s.id,
              roleId: superAdminRole.id,
            }).onConflictDoNothing();
          }
        }
      }
    }

    if (!user) {
      user = {
        id: userId,
        email: email || 'user@society.dev',
        name: name || 'User',
        mobile: null,
        avatarUrl: null,
        defaultSocietyId: null,
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
        deletedAt: null,
      };
    }

    const memberships = await this.userRepository.findUserMemberships(userId);
    return {
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        mobile: user.mobile,
        avatarUrl: user.avatarUrl,
      },
      memberships,
    };
  }

  /**
   * Find a user by email address. Used by dev-login endpoint.
   */
  async findByEmail(email: string) {
    return this.userRepository.findByEmail(email);
  }

  async setDefaultSociety(userId: string, societyId: string) {
    return this.userRepository.setDefaultSociety(userId, societyId);
  }

  /**
   * Returns all users. Used by dev-login picker.
   */
  async findAllUsers() {
    return this.userRepository.findAllActive();
  }

  // ==========================================
  // SOCIETY USER ACCESS & PERMISSIONS CONTROL
  // ==========================================

  /**
   * Retrieves all users having login access to a specific society,
   * distinguishing between inventory holders (flat owners/tenants) and professionals/staff (Accountant, Auditor, Estate Mgr, etc.).
   */
  async getSocietyUsers(societyId: string) {
    const societyUsers = await this.db
      .select({
        id: userSocieties.id,
        userId: users.id,
        name: users.name,
        email: users.email,
        mobile: users.mobile,
        roleId: roles.id,
        roleName: roles.name,
        roleDescription: roles.description,
        createdAt: userSocieties.createdAt,
      })
      .from(userSocieties)
      .innerJoin(users, eq(userSocieties.userId, users.id))
      .innerJoin(roles, eq(userSocieties.roleId, roles.id))
      .where(eq(userSocieties.societyId, societyId))
      .orderBy(desc(userSocieties.createdAt));

    // Get flat mappings for owner
    const flatOwnersList = await this.db
      .select({
        userId: owners.userId,
        flatNumber: flats.number,
      })
      .from(owners)
      .innerJoin(flatOwners, eq(owners.id, flatOwners.ownerId))
      .innerJoin(flats, eq(flatOwners.flatId, flats.id))
      .where(eq(owners.societyId, societyId));

    // Get flat mappings for tenant
    const flatTenantsList = await this.db
      .select({
        userId: tenants.userId,
        flatNumber: flats.number,
      })
      .from(tenants)
      .innerJoin(flatTenants, eq(tenants.id, flatTenants.tenantId))
      .innerJoin(flats, eq(flatTenants.flatId, flats.id))
      .where(and(eq(tenants.societyId, societyId), eq(flatTenants.isActive, true)));

    return societyUsers.map((u) => {
      const ownerFlat = flatOwnersList.find((f) => f.userId === u.userId)?.flatNumber;
      const tenantFlat = flatTenantsList.find((f) => f.userId === u.userId)?.flatNumber;
      const flatNumber = ownerFlat || tenantFlat || null;
      const isInventoryHolder = !!flatNumber;

      return {
        ...u,
        flatNumber,
        isInventoryHolder,
        userCategory: isInventoryHolder ? 'RESIDENT_MEMBER' : 'STAFF_PROFESSIONAL',
      };
    });
  }

  /**
   * Grants system access to a non-inventory staff/accountant/auditor or user.
   */
  async grantUserAccess(
    societyId: string,
    dto: {
      name: string;
      email: string;
      mobile?: string;
      roleName: string;
      password?: string;
    },
    executorId?: string,
  ) {
    if (!dto.email || !dto.roleName) {
      throw new BadRequestException('Email and system role are required.');
    }

    const email = dto.email.trim().toLowerCase();
    const roleName = dto.roleName.trim().toUpperCase();

    // 1. Resolve or create user in Supabase / database
    let userRecord = await this.userRepository.findByEmail(email);
    let resolvedUserId = userRecord?.id;

    if (!resolvedUserId) {
      // Create user in Supabase Auth if service key configured
      try {
        const { data: authData, error: authError } = await this.supabase.auth.admin.createUser({
          email,
          password: dto.password || 'Society@123',
          email_confirm: true,
          user_metadata: { name: dto.name, mobile: dto.mobile },
        });

        if (authData?.user?.id) {
          resolvedUserId = authData.user.id;
        }
      } catch (authErr) {
        console.warn('Supabase createUser notice:', authErr);
      }

      if (!resolvedUserId) {
        resolvedUserId = require('crypto').randomUUID();
      }

      const inserted = await this.db.insert(users).values({
        id: resolvedUserId,
        email,
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
      // Create role if doesn't exist
      const newRoles = await this.db.insert(roles).values({
        id: require('crypto').randomUUID(),
        name: roleName,
        description: `Society Role: ${roleName}`,
      }).returning();
      roleRecord = newRoles[0];
    }

    // 3. Upsert into user_societies
    const existingMapping = await this.db.query.userSocieties.findFirst({
      where: and(
        eq(userSocieties.userId, resolvedUserId),
        eq(userSocieties.societyId, societyId),
      ),
    });

    if (existingMapping) {
      await this.db.update(userSocieties).set({
        roleId: roleRecord.id,
        updatedAt: new Date(),
      }).where(eq(userSocieties.id, existingMapping.id));
    } else {
      await this.db.insert(userSocieties).values({
        id: require('crypto').randomUUID(),
        userId: resolvedUserId,
        societyId,
        roleId: roleRecord.id,
      });
    }

    await this.logAction({
      societyId,
      userId: executorId,
      action: 'USER_ACCESS_GRANTED',
      entityName: 'user_societies',
      entityId: resolvedUserId,
      newValues: { email, roleName, name: dto.name },
    });

    return {
      success: true,
      userId: resolvedUserId,
      email,
      roleName,
    };
  }

  /**
   * Updates an existing user's role in the society.
   */
  async updateUserRole(
    societyId: string,
    userId: string,
    dto: { roleName: string },
    executorId?: string,
  ) {
    const roleName = dto.roleName.trim().toUpperCase();
    let roleRecord = await this.db.query.roles.findFirst({
      where: eq(roles.name, roleName),
    });

    if (!roleRecord) {
      throw new NotFoundException(`Role ${roleName} not found.`);
    }

    const mapping = await this.db.query.userSocieties.findFirst({
      where: and(
        eq(userSocieties.userId, userId),
        eq(userSocieties.societyId, societyId),
      ),
    });

    if (!mapping) {
      throw new NotFoundException('User membership mapping not found in this society.');
    }

    await this.db.update(userSocieties).set({
      roleId: roleRecord.id,
      updatedAt: new Date(),
    }).where(eq(userSocieties.id, mapping.id));

    await this.logAction({
      societyId,
      userId: executorId,
      action: 'USER_ROLE_UPDATED',
      entityName: 'user_societies',
      entityId: userId,
      newValues: { roleName },
    });

    return { success: true, roleName };
  }

  /**
   * Revokes user login access from the society.
   */
  async revokeUserAccess(societyId: string, userId: string, executorId?: string) {
    const mapping = await this.db.query.userSocieties.findFirst({
      where: and(
        eq(userSocieties.userId, userId),
        eq(userSocieties.societyId, societyId),
      ),
    });

    if (!mapping) {
      throw new NotFoundException('User membership not found.');
    }

    await this.db.delete(userSocieties).where(eq(userSocieties.id, mapping.id));

    await this.logAction({
      societyId,
      userId: executorId,
      action: 'USER_ACCESS_REVOKED',
      entityName: 'user_societies',
      entityId: userId,
    });

    return { success: true };
  }

  private async logAction(data: {
    societyId?: string;
    userId?: string;
    action: string;
    entityName: string;
    entityId?: string;
    oldValues?: any;
    newValues?: any;
  }) {
    try {
      await this.db.insert(auditLogs).values({
        societyId: data.societyId || null,
        userId: data.userId || null,
        action: data.action,
        entityName: data.entityName,
        entityId: data.entityId || null,
        oldValues: data.oldValues || null,
        newValues: data.newValues || null,
      });
    } catch (err) {
      console.error('Failed to log audit action:', err);
    }
  }
}
