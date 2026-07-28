import { Injectable, NotFoundException, Inject, BadRequestException } from '@nestjs/common';
import { MemberRepository } from './member.repository';
import { CreateMemberDto, FamilyMemberDto, NomineeDto } from './dto/create-member.dto';
import { UpdateMemberDto } from './dto/update-member.dto';
import { DRIZZLE_PROVIDER, DrizzleDB } from '@core/database/database.module';
import { 
  auditLogs, 
  members, 
  users, 
  familyMembers, 
  nominees,
  userSocieties,
  roles
} from '../../../database/schema';
import { eq, and, or, like } from 'drizzle-orm';

@Injectable()
export class MemberService {
  constructor(
    private readonly memberRepository: MemberRepository,
    @Inject(DRIZZLE_PROVIDER) private readonly db: DrizzleDB,
  ) {}

  async create(dto: CreateMemberDto, executorUserId?: string) {
    const { familyMembers: family, nominees: nomineeList, name, email, mobile, ...memberProps } = dto;
    const activeTenantId = this.memberRepository['activeTenantId'];

    // 1. Resolve or Create User
    let resolvedUserId = memberProps.userId;
    if (!resolvedUserId) {
      if (!email || !name) {
        throw new BadRequestException('Name and email are required to create a new member.');
      }
      let user = await this.db.query.users.findFirst({
        where: eq(users.email, email),
      });

      if (!user) {
        const newUsers = await this.db.insert(users).values({
          id: require('crypto').randomUUID(),
          email,
          name,
          mobile: mobile || null,
        }).returning();
        user = newUsers[0];
      }
      resolvedUserId = user.id;
    }

    // 2. Auto-generate membership number if not provided
    let membershipNumber = memberProps.membershipNumber;
    if (!membershipNumber || membershipNumber.trim() === '') {
      const allMembers = await this.db.query.members.findMany({
        where: eq(members.societyId, activeTenantId),
        columns: { membershipNumber: true },
      });
      let maxNum = 0;
      for (const m of allMembers) {
        const match = m.membershipNumber.match(/^MEM-(\d+)$/);
        if (match) {
          const num = parseInt(match[1], 10);
          if (num > maxNum) maxNum = num;
        }
      }
      membershipNumber = `MEM-${String(maxNum + 1).padStart(4, '0')}`;
    }

    // 3. Insert base member profile
    const member = await this.memberRepository.insert({
      ...memberProps,
      userId: resolvedUserId,
      membershipNumber,
      societyId: activeTenantId,
    });

    // 2. Insert family details if present
    if (family && family.length > 0) {
      await Promise.all(
        family.map((f) =>
          this.db.insert(familyMembers).values({
            societyId: activeTenantId,
            memberId: member.id,
            name: f.name,
            relation: f.relation,
            mobile: f.mobile || null,
            aadhaar: f.aadhaar || null,
          })
        )
      );
    }

    // 3. Insert nominee details if present
    if (nomineeList && nomineeList.length > 0) {
      await Promise.all(
        nomineeList.map((n) =>
          this.db.insert(nominees).values({
            societyId: activeTenantId,
            memberId: member.id,
            name: n.name,
            relation: n.relation,
            mobile: n.mobile || null,
            sharePercentage: n.sharePercentage.toString(),
          })
        )
      );
    }

    await this.logAction({
      societyId: member.societyId,
      userId: executorUserId,
      action: 'MEMBER_CREATE',
      entityName: 'members',
      entityId: member.id,
      newValues: member,
    });

    return member;
  }

  async findAll(filters: { search?: string; memberType?: string; status?: string }, executorId?: string) {
    const list = await this.memberRepository.searchMembers(filters);

    let userRoleName = '';
    if (executorId) {
      const userRoleQuery = await this.db
        .select({ roleName: roles.name })
        .from(userSocieties)
        .innerJoin(roles, eq(userSocieties.roleId, roles.id))
        .where(
          and(
            eq(userSocieties.userId, executorId),
            eq(userSocieties.societyId, this.memberRepository['activeTenantId'])
          )
        );
      if (userRoleQuery.length > 0) {
        userRoleName = userRoleQuery[0].roleName;
      }
    }

    if (['OWNER', 'TENANT', 'ACCOUNTANT'].includes(userRoleName) && executorId) {
      return list.map((m: any) => {
        if (m.userId !== executorId) {
          return {
            ...m,
            email: m.email ? m.email.replace(/^(.{2})(.*)(@.*)$/, '$1***$3') : null,
            mobile: m.mobile ? m.mobile.replace(/^(\+\d{2}\d{2})\d+(\d{2})$/, '$1*****$2') : null,
          };
        }
        return m;
      });
    }

    return list;
  }

  async searchUsers(query?: string) {
    if (!query || query.trim().length < 2) return [];
    
    return this.db
      .select({
        id: users.id,
        name: users.name,
        email: users.email,
        mobile: users.mobile,
      })
      .from(users)
      .where(
        and(
          eq(users.isActive, true),
          or(
            like(users.name, `%${query}%`),
            like(users.email, `%${query}%`)
          )!
        )
      )
      .limit(20);
  }

  async findOne(id: string, executorId?: string) {
    const details = await this.memberRepository.findDetailsById(id);
    if (!details) {
      throw new NotFoundException('Member profile not found in this society.');
    }

    let userRoleName = '';
    if (executorId) {
      const userRoleQuery = await this.db
        .select({ roleName: roles.name })
        .from(userSocieties)
        .innerJoin(roles, eq(userSocieties.roleId, roles.id))
        .where(
          and(
            eq(userSocieties.userId, executorId),
            eq(userSocieties.societyId, this.memberRepository['activeTenantId'])
          )
        );
      if (userRoleQuery.length > 0) {
        userRoleName = userRoleQuery[0].roleName;
      }
    }

    // Role-based privacy: OWNER / TENANT / ACCOUNTANT viewing someone else's profile cannot view sensitive KYC docs or emergency contacts
    if (['OWNER', 'TENANT', 'ACCOUNTANT'].includes(userRoleName) && details.userId !== executorId) {
      return {
        ...details,
        aadhaarUrl: null,
        panUrl: null,
        agreementUrl: null,
        policeVerificationUrl: null,
        emergencyContactName: null,
        emergencyContactPhone: null,
        familyMembers: (details.familyMembers || []).map((f: any) => ({
          ...f,
          aadhaar: null,
        })),
        nominees: (details.nominees || []).map((n: any) => ({
          ...n,
          sharePercentage: null,
          mobile: null,
        })),
      };
    }

    return details;
  }

  async update(id: string, dto: UpdateMemberDto, userId?: string) {
    const current = await this.memberRepository.findById(id);
    if (!current) {
      throw new NotFoundException('Member profile not found.');
    }

    const { familyMembers: family, nominees: nomineeList, ...memberProps } = dto;
    const activeTenantId = this.memberRepository['activeTenantId'];

    // 1. Update properties
    let updated = current;
    if (Object.keys(memberProps).length > 0) {
      updated = await this.memberRepository.update(id, memberProps);
    }

    // 2. Synchronize family members if provided
    if (family) {
      // Clear current list and re-insert
      await this.db
        .delete(familyMembers)
        .where(eq(familyMembers.memberId, id));

      await Promise.all(
        family.map((f) =>
          this.db.insert(familyMembers).values({
            societyId: activeTenantId,
            memberId: id,
            name: f.name!,
            relation: f.relation!,
            mobile: f.mobile || null,
            aadhaar: f.aadhaar || null,
          })
        )
      );
    }

    // 3. Synchronize nominees if provided
    if (nomineeList) {
      // Clear current list and re-insert
      await this.db
        .delete(nominees)
        .where(eq(nominees.memberId, id));

      await Promise.all(
        nomineeList.map((n) =>
          this.db.insert(nominees).values({
            societyId: activeTenantId,
            memberId: id,
            name: n.name!,
            relation: n.relation!,
            mobile: n.mobile || null,
            sharePercentage: n.sharePercentage ? n.sharePercentage.toString() : '100.00',
          })
        )
      );
    }

    await this.logAction({
      societyId: current.societyId,
      userId,
      action: 'MEMBER_UPDATE',
      entityName: 'members',
      entityId: id,
      oldValues: current,
      newValues: updated,
    });

    return this.findOne(id);
  }

  async remove(id: string, userId?: string) {
    const current = await this.memberRepository.findById(id);
    if (!current) {
      throw new NotFoundException('Member profile not found.');
    }

    await this.memberRepository.delete(id);

    await this.logAction({
      societyId: current.societyId,
      userId,
      action: 'MEMBER_DELETE',
      entityName: 'members',
      entityId: id,
      oldValues: current,
    });

    return { success: true };
  }

  /**
   * Generates clean comma-separated file format stream representing roster list.
   */
  async exportCsv(): Promise<string> {
    const list = await this.memberRepository.searchMembers({});
    
    let csvContent = 'Membership Number,Member Type,Status,Full Name,Email,Mobile\n';
    
    list.forEach((m: any) => {
      csvContent += `"${m.membershipNumber}","${m.memberType}","${m.status}","${m.name || ''}","${m.email || ''}","${m.mobile || ''}"\n`;
    });

    return csvContent;
  }

  /**
   * Performs bulk transactional import of member CSV text.
   */
  async importCsv(csvString: string, executorId?: string) {
    const activeTenantId = this.memberRepository['activeTenantId'];
    const lines = csvString.split('\n');
    if (lines.length <= 1) {
      throw new BadRequestException('CSV content is empty or lacks headers.');
    }

    const insertedRecords = [];

    // Skip header line
    for (let i = 1; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line) continue;

      // Basic comma splitter (handling simple quotes)
      const cols = line.split(',').map((c) => c.replace(/^"|"$/g, '').trim());
      if (cols.length < 5) continue;

      const [membershipNumber, memberType, name, email, mobile] = cols;

      // 1. Resolve or create user profile for email target mapping
      let user = await this.db.query.users.findFirst({
        where: eq(users.email, email),
      });

      if (!user) {
        // Create user with default dummy credentials
        const newUsers = await this.db.insert(users).values({
          id: require('crypto').randomUUID(),
          email,
          name,
          mobile: mobile || null,
        }).returning();
        user = newUsers[0];
      }

      // 2. Register membership mapping
      const member = await this.memberRepository.insert({
        societyId: activeTenantId,
        userId: user.id,
        membershipNumber,
        memberType: (memberType || 'OWNER') as any,
        status: 'ACTIVE',
      });

      insertedRecords.push(member);
    }

    await this.logAction({
      societyId: activeTenantId,
      userId: executorId,
      action: 'MEMBER_BULK_IMPORT',
      entityName: 'members',
      newValues: { count: insertedRecords.length },
    });

    return { importedCount: insertedRecords.length };
  }

  async bulkCreate(dtos: CreateMemberDto[], executorId?: string) {
    const activeTenantId = this.memberRepository['activeTenantId'];
    if (!dtos || dtos.length === 0) return { importedCount: 0 };
    
    let importedCount = 0;
    // Sequential loop to ensure membership numbers generate correctly
    for (const dto of dtos) {
      try {
        await this.create(dto, executorId);
        importedCount++;
      } catch (err) {
        console.error('Failed to create member in bulk:', err);
      }
    }

    await this.logAction({
      societyId: activeTenantId,
      userId: executorId,
      action: 'MEMBER_BULK_JSON_IMPORT',
      entityName: 'members',
      newValues: { count: importedCount },
    });

    return { importedCount };
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
