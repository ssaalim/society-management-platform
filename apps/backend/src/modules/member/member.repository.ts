import { Injectable, Inject } from '@nestjs/common';
import { TenantBaseRepository } from '@core/database/base.repository';
import { 
  members, 
  users, 
  familyMembers, 
  nominees, 
  owners,
  tenants,
  flatOwners, 
  flatTenants, 
  flats, 
  vehicles,
  userSocieties,
  roles
} from '../../../database/schema';
import { DRIZZLE_PROVIDER, DrizzleDB } from '@core/database/database.module';
import { ClsService } from 'nestjs-cls';
import { eq, and, like, or } from 'drizzle-orm';

@Injectable()
export class MemberRepository extends TenantBaseRepository<typeof members> {
  constructor(
    @Inject(DRIZZLE_PROVIDER) protected readonly db: DrizzleDB,
    protected readonly cls: ClsService,
  ) {
    super(db, cls, members);
  }

  /**
   * Retrieves a single member complete detailed profile context.
   */
  async findDetailsById(id: string) {
    const records = await this.db
      .select({
        member: members,
        name: users.name,
        email: users.email,
        mobile: users.mobile,
      })
      .from(members)
      .innerJoin(users, eq(members.userId, users.id))
      .where(
        and(
          eq(members.id, id),
          eq(members.societyId, this.activeTenantId)
        )
      );

    if (records.length === 0) return null;

    const details = records[0];

    // Fetch family members
    const family = await this.db
      .select()
      .from(familyMembers)
      .where(eq(familyMembers.memberId, id));

    // Fetch nominees
    const nomineeList = await this.db
      .select()
      .from(nominees)
      .where(eq(nominees.memberId, id));

    // Fetch flats linked to this member's user via owners/tenants tables
    const userId = details.member.userId;

    // owners.userId → flatOwners.ownerId → flats
    const ownedFlats = await this.db
      .select({
        flatId: flats.id,
        number: flats.number,
        flatType: flats.flatType,
        isPrimary: flatOwners.isPrimary,
        isCurrent: flatOwners.isCurrent,
        startDate: flatOwners.startDate,
        endDate: flatOwners.endDate,
        ownershipShare: flatOwners.ownershipShare,
      })
      .from(flatOwners)
      .innerJoin(flats, eq(flatOwners.flatId, flats.id))
      .innerJoin(owners, eq(flatOwners.ownerId, owners.id))
      .where(eq(owners.userId, userId));

    // tenants.userId → flatTenants.tenantId → flats
    const rentedFlats = await this.db
      .select({
        flatId: flats.id,
        number: flats.number,
        flatType: flats.flatType,
        leaseStart: flatTenants.leaseStart,
        leaseEnd: flatTenants.leaseEnd,
        isActive: flatTenants.isActive,
      })
      .from(flatTenants)
      .innerJoin(flats, eq(flatTenants.flatId, flats.id))
      .innerJoin(tenants, eq(flatTenants.tenantId, tenants.id))
      .where(eq(tenants.userId, userId));

    // Fetch vehicles
    const vehicleList = await this.db
      .select()
      .from(vehicles)
      .where(
        or(
          ownedFlats.length > 0 ? eq(vehicles.flatId, ownedFlats[0].flatId) : undefined,
          rentedFlats.length > 0 ? eq(vehicles.flatId, rentedFlats[0].flatId) : undefined,
        )
      );

    // Fetch assigned system role
    const userRoleQuery = await this.db
      .select({ roleName: roles.name })
      .from(userSocieties)
      .innerJoin(roles, eq(userSocieties.roleId, roles.id))
      .where(
        and(
          eq(userSocieties.userId, userId),
          eq(userSocieties.societyId, this.activeTenantId)
        )
      );
    const assignedRole = userRoleQuery.length > 0 ? userRoleQuery[0].roleName : (details.member.memberType || 'OWNER');

    return {
      ...details.member,
      name: details.name,
      email: details.email,
      mobile: details.mobile,
      role: assignedRole,
      familyMembers: family,
      nominees: nomineeList,
      ownedFlats,
      rentedFlats,
      vehicles: vehicleList,
    };
  }

  /**
   * Searches and filters members based on query context.
   */
  async searchMembers(filters: {
    search?: string;
    memberType?: string;
    committeeDesignation?: string;
    status?: string;
  }) {
    const whereClauses = [eq(members.societyId, this.activeTenantId)];

    if (filters.memberType) {
      whereClauses.push(eq(members.memberType, filters.memberType));
    }
    if (filters.committeeDesignation) {
      if (filters.committeeDesignation === 'NONE') {
        whereClauses.push(or(eq(members.committeeDesignation, 'NONE'), eq(members.committeeDesignation, ''))!);
      } else {
        whereClauses.push(eq(members.committeeDesignation, filters.committeeDesignation));
      }
    }
    if (filters.status) {
      whereClauses.push(eq(members.status, filters.status));
    }
    if (filters.search) {
      whereClauses.push(
        or(
          like(users.name, `%${filters.search}%`),
          like(members.membershipNumber, `%${filters.search}%`),
          like(users.email, `%${filters.search}%`),
          like(users.mobile, `%${filters.search}%`)
        )!
      );
    }

    return this.db
      .select({
        id: members.id,
        userId: members.userId,
        membershipNumber: members.membershipNumber,
        memberType: members.memberType,
        committeeDesignation: members.committeeDesignation,
        status: members.status,
        name: users.name,
        email: users.email,
        mobile: users.mobile,
        photoUrl: members.photoUrl,
        canLogin: members.canLogin,
        createdAt: members.createdAt,
      })
      .from(members)
      .innerJoin(users, eq(members.userId, users.id))
      .where(and(...whereClauses))
      .orderBy(members.membershipNumber);
  }
}
