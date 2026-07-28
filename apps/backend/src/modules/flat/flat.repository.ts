import { Injectable, Inject, ForbiddenException } from '@nestjs/common';
import { TenantBaseRepository } from '@core/database/base.repository';
import { 
  flats, 
  floors, 
  wings, 
  buildings, 
  flatOwners, 
  owners, 
  users, 
  flatTenants, 
  tenants,
  userSocieties,
  roles,
  members
} from '../../../database/schema';
import { DRIZZLE_PROVIDER, DrizzleDB } from '@core/database/database.module';
import { ClsService } from 'nestjs-cls';
import { eq, and, like, inArray } from 'drizzle-orm';

@Injectable()
export class FlatRepository extends TenantBaseRepository<typeof flats> {
  constructor(
    @Inject(DRIZZLE_PROVIDER) protected readonly db: DrizzleDB,
    protected readonly cls: ClsService,
  ) {
    super(db, cls, flats);
  }

  /**
   * Retrieves a single flat detailed profile context (including floor name, wing, building, active owners and tenants).
   * Validates that OWNER / TENANT users can only view their own assigned flat.
   */
  async findDetailsById(id: string, executorId?: string) {
    let userRoleName = '';
    if (executorId) {
      const userRoleQuery = await this.db
        .select({ roleName: roles.name })
        .from(userSocieties)
        .innerJoin(roles, eq(userSocieties.roleId, roles.id))
        .where(
          and(
            eq(userSocieties.userId, executorId),
            eq(userSocieties.societyId, this.activeTenantId)
          )
        );
      if (userRoleQuery.length > 0) {
        userRoleName = userRoleQuery[0].roleName;
      }
    }

    if (['OWNER', 'TENANT'].includes(userRoleName) && executorId) {
      const ownedFlats = await this.db
        .select()
        .from(flatOwners)
        .innerJoin(owners, eq(flatOwners.ownerId, owners.id))
        .where(and(eq(flatOwners.flatId, id), eq(owners.userId, executorId)));

      const rentedFlats = await this.db
        .select()
        .from(flatTenants)
        .innerJoin(tenants, eq(flatTenants.tenantId, tenants.id))
        .where(and(eq(flatTenants.flatId, id), eq(tenants.userId, executorId), eq(flatTenants.isActive, true)));

      if (ownedFlats.length === 0 && rentedFlats.length === 0) {
        throw new ForbiddenException('Access denied. Residents can only view details of their own assigned flat unit.');
      }
    }

    const flatRecord = await this.db
      .select({
        flat: flats,
        floorNumber: floors.number,
        wingName: wings.name,
        buildingName: buildings.name,
      })
      .from(flats)
      .innerJoin(floors, eq(flats.floorId, floors.id))
      .innerJoin(wings, eq(floors.wingId, wings.id))
      .innerJoin(buildings, eq(wings.buildingId, buildings.id))
      .where(
        and(
          eq(flats.id, id),
          eq(flats.societyId, this.activeTenantId)
        )
      );

    if (flatRecord.length === 0) return null;

    const details = flatRecord[0];

    // Fetch current active owners
    const currentOwners = await this.db
      .select({
        ownerId: owners.id,
        name: users.name,
        email: users.email,
        mobile: users.mobile,
        isPrimary: flatOwners.isPrimary,
        isCurrent: flatOwners.isCurrent,
        startDate: flatOwners.startDate,
        ownershipShare: flatOwners.ownershipShare,
      })
      .from(flatOwners)
      .innerJoin(owners, eq(flatOwners.ownerId, owners.id))
      .innerJoin(users, eq(owners.userId, users.id))
      .where(and(eq(flatOwners.flatId, id), eq(flatOwners.isCurrent, true)));

    // Fetch full owner timeline history (current and past)
    const ownerHistory = await this.getOwnerHistory(id);

    // Fetch active tenant lease context
    const activeLease = await this.db
      .select({
        leaseId: flatTenants.id,
        tenantId: tenants.id,
        name: users.name,
        email: users.email,
        mobile: users.mobile,
        leaseStart: flatTenants.leaseStart,
        leaseEnd: flatTenants.leaseEnd,
        rentalAgreementUrl: flatTenants.rentalAgreementUrl,
        policeVerificationUrl: flatTenants.policeVerificationUrl,
        tenantNocUrl: flatTenants.tenantNocUrl,
        emergencyContactName: flatTenants.emergencyContactName,
        emergencyContactPhone: flatTenants.emergencyContactPhone,
      })
      .from(flatTenants)
      .innerJoin(tenants, eq(flatTenants.tenantId, tenants.id))
      .innerJoin(users, eq(tenants.userId, users.id))
      .where(
        and(
          eq(flatTenants.flatId, id),
          eq(flatTenants.isActive, true)
        )
      );

    // Fetch previous occupancy histories
    const occupancyHistory = await this.db
      .select({
        leaseId: flatTenants.id,
        name: users.name,
        leaseStart: flatTenants.leaseStart,
        leaseEnd: flatTenants.leaseEnd,
        moveInDate: flatTenants.moveInDate,
        moveOutDate: flatTenants.moveOutDate,
      })
      .from(flatTenants)
      .innerJoin(tenants, eq(flatTenants.tenantId, tenants.id))
      .innerJoin(users, eq(tenants.userId, users.id))
      .where(
        and(
          eq(flatTenants.flatId, id),
          eq(flatTenants.isActive, false)
        )
      );

    return {
      ...details.flat,
      floorNumber: details.floorNumber,
      wingName: details.wingName,
      buildingName: details.buildingName,
      owners: currentOwners,
      ownerHistory,
      activeTenant: activeLease[0] || null,
      history: occupancyHistory,
    };
  }

  /**
   * Fetches complete chronological owner history for a flat.
   */
  async getOwnerHistory(flatId: string) {
    return this.db
      .select({
        id: flatOwners.id,
        ownerId: owners.id,
        name: users.name,
        email: users.email,
        mobile: users.mobile,
        isPrimary: flatOwners.isPrimary,
        isCurrent: flatOwners.isCurrent,
        startDate: flatOwners.startDate,
        endDate: flatOwners.endDate,
        notes: flatOwners.notes,
        ownershipShare: flatOwners.ownershipShare,
      })
      .from(flatOwners)
      .innerJoin(owners, eq(flatOwners.ownerId, owners.id))
      .innerJoin(users, eq(owners.userId, users.id))
      .where(eq(flatOwners.flatId, flatId))
      .orderBy(flatOwners.startDate);
  }

  /**
   * Searches and filters flats matching query contexts.
   * Scopes result list if the requesting user is an OWNER / RESIDENT.
   */
  async searchFlats(filters: {
    search?: string;
    buildingId?: string;
    wingId?: string;
    userId?: string;
    ownerMemberId?: string;
  }) {
    let userRoleName = '';
    if (filters.userId) {
      const userRoleQuery = await this.db
        .select({ roleName: roles.name })
        .from(userSocieties)
        .innerJoin(roles, eq(userSocieties.roleId, roles.id))
        .where(
          and(
            eq(userSocieties.userId, filters.userId),
            eq(userSocieties.societyId, this.activeTenantId)
          )
        );
      if (userRoleQuery.length > 0) {
        userRoleName = userRoleQuery[0].roleName;
      }
    }

    const whereClauses = [eq(flats.societyId, this.activeTenantId)];

    if (filters.search) {
      whereClauses.push(like(flats.number, `%${filters.search}%`));
    }
    if (filters.buildingId) {
      whereClauses.push(eq(buildings.id, filters.buildingId));
    }
    if (filters.wingId) {
      whereClauses.push(eq(wings.id, filters.wingId));
    }

    // Role-based scoping: OWNER / TENANT role only sees their own assigned flats
    if (['OWNER', 'TENANT'].includes(userRoleName) && filters.userId) {
      const ownedFlats = await this.db
        .select({ flatId: flatOwners.flatId })
        .from(flatOwners)
        .innerJoin(owners, eq(flatOwners.ownerId, owners.id))
        .where(eq(owners.userId, filters.userId));

      const rentedFlats = await this.db
        .select({ flatId: flatTenants.flatId })
        .from(flatTenants)
        .innerJoin(tenants, eq(flatTenants.tenantId, tenants.id))
        .where(
          and(
            eq(tenants.userId, filters.userId),
            eq(flatTenants.isActive, true)
          )
        );

      const userFlatIds = [
        ...ownedFlats.map((f) => f.flatId),
        ...rentedFlats.map((f) => f.flatId),
      ];

      if (userFlatIds.length > 0) {
        whereClauses.push(inArray(flats.id, userFlatIds));
      } else {
        return [];
      }
    }

    if (filters.ownerMemberId) {
      const memberRec = await this.db.select().from(members).where(eq(members.id, filters.ownerMemberId));
      if (memberRec.length > 0) {
        const targetUserId = memberRec[0].userId;
        const ownedByFilter = await this.db
          .select({ flatId: flatOwners.flatId })
          .from(flatOwners)
          .innerJoin(owners, eq(flatOwners.ownerId, owners.id))
          .where(
            and(
              eq(owners.userId, targetUserId),
              eq(flatOwners.isCurrent, true)
            )
          );
          
        if (ownedByFilter.length > 0) {
          whereClauses.push(inArray(flats.id, ownedByFilter.map(f => f.flatId)));
        } else {
          return []; // If member has no flats, return empty list
        }
      } else {
        return []; // Member not found
      }
    }

    return this.db
      .select({
        id: flats.id,
        number: flats.number,
        flatType: flats.flatType,
        sqftArea: flats.sqftArea,
        floorNumber: floors.number,
        wingName: wings.name,
        buildingName: buildings.name,
        buildingId: buildings.id,
        wingId: wings.id,
      })
      .from(flats)
      .innerJoin(floors, eq(flats.floorId, floors.id))
      .innerJoin(wings, eq(floors.wingId, wings.id))
      .innerJoin(buildings, eq(wings.buildingId, buildings.id))
      .where(and(...whereClauses));
  }

  // ==========================================
  // Layout Master Configuration Methods
  // ==========================================

  async getLayoutHierarchy() {
    const allBuildings = await this.db
      .select()
      .from(buildings)
      .where(eq(buildings.societyId, this.activeTenantId))
      .orderBy(buildings.name);

    const allWings = await this.db
      .select()
      .from(wings)
      .where(eq(wings.societyId, this.activeTenantId))
      .orderBy(wings.name);

    const allFloors = await this.db
      .select()
      .from(floors)
      .where(eq(floors.societyId, this.activeTenantId))
      .orderBy(floors.number);

    // Build hierarchy
    return allBuildings.map(b => ({
      id: b.id,
      name: b.name,
      wings: allWings
        .filter(w => w.buildingId === b.id)
        .map(w => ({
          id: w.id,
          name: w.name,
          floors: allFloors
            .filter(f => f.wingId === w.id)
            .map(f => ({
              id: f.id,
              number: f.number
            }))
        }))
    }));
  }

  async createBuilding(name: string) {
    const res = await this.db.insert(buildings).values({
      societyId: this.activeTenantId,
      name
    }).returning();
    return res[0];
  }

  async createWing(buildingId: string, name: string) {
    const res = await this.db.insert(wings).values({
      societyId: this.activeTenantId,
      buildingId,
      name
    }).returning();
    return res[0];
  }

  async createFloor(wingId: string, number: number) {
    const res = await this.db.insert(floors).values({
      societyId: this.activeTenantId,
      wingId,
      number
    }).returning();
    return res[0];
  }

  async updateBuilding(id: string, name: string) {
    const res = await this.db.update(buildings)
      .set({ name })
      .where(and(eq(buildings.id, id), eq(buildings.societyId, this.activeTenantId)))
      .returning();
    return res[0];
  }

  async updateWing(id: string, name: string) {
    const res = await this.db.update(wings)
      .set({ name })
      .where(and(eq(wings.id, id), eq(wings.societyId, this.activeTenantId)))
      .returning();
    return res[0];
  }

  async updateFloor(id: string, number: number) {
    const res = await this.db.update(floors)
      .set({ number })
      .where(and(eq(floors.id, id), eq(floors.societyId, this.activeTenantId)))
      .returning();
    return res[0];
  }
}
