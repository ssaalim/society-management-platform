import { Injectable, NotFoundException, Inject, BadRequestException } from '@nestjs/common';
import { FlatRepository } from './flat.repository';
import { CreateFlatDto } from './dto/create-flat.dto';
import { UpdateFlatDto } from './dto/update-flat.dto';
import { DRIZZLE_PROVIDER, DrizzleDB } from '@core/database/database.module';
import { auditLogs, flatOwners, flatTenants, owners, users, floors, members, tenants } from '../../../database/schema';
import { eq, and } from 'drizzle-orm';
import { v4 as uuidv4 } from 'uuid';

@Injectable()
export class FlatService {
  constructor(
    private readonly flatRepository: FlatRepository,
    @Inject(DRIZZLE_PROVIDER) private readonly db: DrizzleDB,
  ) {}

  async create(dto: CreateFlatDto, userId?: string) {
    const {
      ownerId,
      tenantId,
      leaseStart,
      leaseEnd,
      rentalAgreementUrl,
      policeVerificationUrl,
      tenantNocUrl,
      emergencyContactName,
      emergencyContactPhone,
      moveInDate,
      ...flatProps
    } = dto;

    let payload = { ...flatProps };
    if (!payload.floorId) {
      const activeTenantId = this.flatRepository['activeTenantId'];
      const firstFloor = await this.db.select().from(floors).where(eq(floors.societyId, activeTenantId)).limit(1);
      if (firstFloor.length > 0) {
        payload.floorId = firstFloor[0].id;
      } else {
        throw new BadRequestException('No building floor layout found in society to attach flat unit.');
      }
    }

    const flat = await this.flatRepository.insert(payload as any);

    if (ownerId) {
      await this.assignOwner(flat.id, ownerId);
    }

    if (tenantId && leaseStart && leaseEnd) {
      await this.moveInTenant(flat.id, {
        tenantId,
        leaseStart,
        leaseEnd,
        rentalAgreementUrl,
        policeVerificationUrl,
        tenantNocUrl,
        emergencyContactName,
        emergencyContactPhone,
        moveInDate,
      });
    }

    await this.logAction({
      societyId: flat.societyId,
      userId,
      action: 'FLAT_CREATE',
      entityName: 'flats',
      entityId: flat.id,
      newValues: flat,
    });

    return this.findOne(flat.id, userId);
  }

  async findAll(filters: { search?: string; buildingId?: string; wingId?: string; occupancyStatus?: string; ownerMemberId?: string }, userId?: string) {
    const list = await this.flatRepository.searchFlats({ ...filters, userId });

    const enrichedList = await Promise.all(
      list.map(async (f) => {
        const occupancy = await this.resolveOccupancyStatus(f.id);
        return {
          ...f,
          occupancyStatus: occupancy,
        };
      })
    );

    if (filters.occupancyStatus) {
      return enrichedList.filter((f) => f.occupancyStatus === filters.occupancyStatus);
    }

    return enrichedList;
  }

  async findOne(id: string, userId?: string) {
    const flat = await this.flatRepository.findDetailsById(id);
    if (!flat) {
      throw new NotFoundException(`Flat with ID ${id} not found.`);
    }

    const occupancyStatus = await this.resolveOccupancyStatus(id);
    return {
      ...flat,
      occupancyStatus,
    };
  }

  async getOwnerHistory(flatId: string) {
    return this.flatRepository.getOwnerHistory(flatId);
  }

  async update(id: string, dto: UpdateFlatDto, userId?: string) {
    const current = await this.findOne(id);
    const {
      ownerId,
      tenantId,
      leaseStart,
      leaseEnd,
      rentalAgreementUrl,
      policeVerificationUrl,
      tenantNocUrl,
      emergencyContactName,
      emergencyContactPhone,
      moveInDate,
      moveOutDate,
      ...flatProps
    } = dto as any;

    const updated = await this.flatRepository.update(id, flatProps);

    if (ownerId) {
      await this.assignOwner(id, ownerId);
    }

    if (tenantId && leaseStart && leaseEnd) {
      await this.moveInTenant(id, {
        tenantId,
        leaseStart,
        leaseEnd,
        rentalAgreementUrl,
        policeVerificationUrl,
        tenantNocUrl,
        emergencyContactName,
        emergencyContactPhone,
        moveInDate,
      });
    }

    if (moveOutDate) {
      await this.moveOutTenant(id, moveOutDate);
    }

    await this.logAction({
      societyId: current.societyId,
      userId,
      action: 'FLAT_UPDATE',
      entityName: 'flats',
      entityId: id,
      oldValues: current,
      newValues: updated,
    });

    return this.findOne(id);
  }

  /**
   * Links a user profile or member record as owner of a flat.
   */
  async assignOwner(flatId: string, inputOwnerId: string) {
    let resolvedOwnerId = inputOwnerId;
    const activeTenantId = this.flatRepository['activeTenantId'];

    // Check if inputOwnerId exists in `owners` table directly
    const ownerRec = await this.db.select().from(owners).where(eq(owners.id, inputOwnerId));
    if (ownerRec.length > 0) {
      resolvedOwnerId = ownerRec[0].id;
    } else {
      // Check if inputOwnerId is a memberId in `members` table
      const memberRec = await this.db.select().from(members).where(eq(members.id, inputOwnerId));
      if (memberRec.length > 0) {
        const existingOwner = await this.db.select().from(owners).where(eq(owners.userId, memberRec[0].userId));
        if (existingOwner.length > 0) {
          resolvedOwnerId = existingOwner[0].id;
        } else {
          const newOwner = await this.db.insert(owners).values({
            societyId: activeTenantId,
            userId: memberRec[0].userId,
          }).returning();
          resolvedOwnerId = newOwner[0].id;
        }
      } else {
        // Check if inputOwnerId is a userId
        const userRec = await this.db.select().from(users).where(eq(users.id, inputOwnerId));
        if (userRec.length > 0) {
          const existingOwner = await this.db.select().from(owners).where(eq(owners.userId, inputOwnerId));
          if (existingOwner.length > 0) {
            resolvedOwnerId = existingOwner[0].id;
          } else {
            const newOwner = await this.db.insert(owners).values({
              societyId: activeTenantId,
              userId: inputOwnerId,
            }).returning();
            resolvedOwnerId = newOwner[0].id;
          }
        }
      }
    }

    // Check if mapping already exists
    const existing = await this.db
      .select()
      .from(flatOwners)
      .where(
        and(
          eq(flatOwners.flatId, flatId),
          eq(flatOwners.ownerId, resolvedOwnerId)
        )
      );

    if (existing.length > 0) return;

    await this.db.insert(flatOwners).values({
      flatId,
      ownerId: resolvedOwnerId,
      isPrimary: true,
      isCurrent: true,
      startDate: new Date().toISOString().substring(0, 10),
      ownershipShare: '100.00',
    });
  }

  /**
   * Transfers ownership of a flat to a new owner, archiving the previous owner with an end date.
   */
  async changeOwner(flatId: string, dto: {
    newOwnerId?: string;
    newOwnerName?: string;
    newOwnerEmail?: string;
    newOwnerMobile?: string;
    transferDate: string;
    notes?: string;
    ownershipShare?: string;
  }, executorId?: string) {
    const flat = await this.flatRepository.findById(flatId);
    if (!flat) {
      throw new NotFoundException('Flat unit not found.');
    }

    let targetOwnerId = dto.newOwnerId;

    // If newOwnerId is not provided directly, resolve or create user & owner record
    if (!targetOwnerId && dto.newOwnerEmail) {
      const existingUser = await this.db.select().from(users).where(eq(users.email, dto.newOwnerEmail));

      let userId = existingUser[0]?.id;
      if (!userId) {
        const newUserId = uuidv4();
        await this.db.insert(users).values({
          id: newUserId,
          email: dto.newOwnerEmail,
          name: dto.newOwnerName || 'Flat Owner',
          mobile: dto.newOwnerMobile || null,
        });
        userId = newUserId;
      }

      const existingOwner = await this.db.select().from(owners).where(
        and(eq(owners.societyId, flat.societyId), eq(owners.userId, userId))
      );

      if (existingOwner.length > 0) {
        targetOwnerId = existingOwner[0].id;
      } else {
        const newOwners = await this.db.insert(owners).values({
          societyId: flat.societyId,
          userId,
        }).returning();
        targetOwnerId = newOwners[0].id;
      }
    }

    if (!targetOwnerId) {
      throw new BadRequestException('A valid new owner ID or new owner email details must be provided.');
    }

    const transferDate = dto.transferDate || new Date().toISOString().substring(0, 10);

    // 1. Archive current active owners for this flat
    await this.db
      .update(flatOwners)
      .set({
        isCurrent: false,
        endDate: transferDate,
      })
      .where(and(eq(flatOwners.flatId, flatId), eq(flatOwners.isCurrent, true)));

    // 2. Insert new active owner record
    await this.db.insert(flatOwners).values({
      flatId,
      ownerId: targetOwnerId,
      isPrimary: true,
      isCurrent: true,
      startDate: transferDate,
      ownershipShare: dto.ownershipShare || '100.00',
      notes: dto.notes || 'Ownership transferred via flat setup',
    });

    await this.logAction({
      societyId: flat.societyId,
      userId: executorId,
      action: 'FLAT_OWNER_CHANGE',
      entityName: 'flats',
      entityId: flatId,
      newValues: { newOwnerId: targetOwnerId, transferDate, notes: dto.notes },
    });

    return this.findOne(flatId, executorId);
  }

  /**
   * Registers checkin move-in logs for tenants.
   */
  async moveInTenant(flatId: string, data: {
    tenantId: string;
    leaseStart: string;
    leaseEnd: string;
    rentalAgreementUrl?: string | null;
    policeVerificationUrl?: string | null;
    tenantNocUrl?: string | null;
    emergencyContactName?: string | null;
    emergencyContactPhone?: string | null;
    moveInDate?: string | null;
  }) {
    let resolvedTenantId = data.tenantId;
    const activeTenantId = this.flatRepository['activeTenantId'];

    const tenantRec = await this.db.select().from(tenants).where(eq(tenants.id, data.tenantId));
    if (tenantRec.length > 0) {
      resolvedTenantId = tenantRec[0].id;
    } else {
      const memberRec = await this.db.select().from(members).where(eq(members.id, data.tenantId));
      if (memberRec.length > 0) {
        const existingTenant = await this.db.select().from(tenants).where(eq(tenants.userId, memberRec[0].userId));
        if (existingTenant.length > 0) {
          resolvedTenantId = existingTenant[0].id;
        } else {
          const newTenant = await this.db.insert(tenants).values({
            societyId: activeTenantId,
            userId: memberRec[0].userId,
          }).returning();
          resolvedTenantId = newTenant[0].id;
        }
      } else {
        const userRec = await this.db.select().from(users).where(eq(users.id, data.tenantId));
        if (userRec.length > 0) {
          const existingTenant = await this.db.select().from(tenants).where(eq(tenants.userId, data.tenantId));
          if (existingTenant.length > 0) {
            resolvedTenantId = existingTenant[0].id;
          } else {
            const newTenant = await this.db.insert(tenants).values({
              societyId: activeTenantId,
              userId: data.tenantId,
            }).returning();
            resolvedTenantId = newTenant[0].id;
          }
        }
      }
    }

    // Terminate any currently active tenancies first
    await this.db
      .update(flatTenants)
      .set({ isActive: false, moveOutDate: data.moveInDate || new Date().toISOString().substring(0, 10) })
      .where(
        and(
          eq(flatTenants.flatId, flatId),
          eq(flatTenants.isActive, true)
        )
      );

    await this.db.insert(flatTenants).values({
      societyId: activeTenantId,
      flatId,
      tenantId: resolvedTenantId,
      leaseStart: data.leaseStart,
      leaseEnd: data.leaseEnd,
      isActive: true,
      rentalAgreementUrl: data.rentalAgreementUrl || null,
      policeVerificationUrl: data.policeVerificationUrl || null,
      tenantNocUrl: data.tenantNocUrl || null,
      emergencyContactName: data.emergencyContactName || null,
      emergencyContactPhone: data.emergencyContactPhone || null,
      moveInDate: data.moveInDate || null,
    });
  }

  /**
   * Deactivates tenancy, logging move-out details.
   */
  async moveOutTenant(flatId: string, moveOutDate: string) {
    await this.db
      .update(flatTenants)
      .set({ 
        isActive: false, 
        moveOutDate 
      })
      .where(
        and(
          eq(flatTenants.flatId, flatId),
          eq(flatTenants.isActive, true)
        )
      );
  }

  /**
   * Resolves the active occupancy profile state of a flat.
   */
  private async resolveOccupancyStatus(flatId: string): Promise<'TENANT_OCCUPIED' | 'OWNER_OCCUPIED' | 'VACANT'> {
    // 1. Check if there is an active tenant lease
    const activeTenant = await this.db
      .select()
      .from(flatTenants)
      .where(
        and(
          eq(flatTenants.flatId, flatId),
          eq(flatTenants.isActive, true)
        )
      );

    if (activeTenant.length > 0) {
      return 'TENANT_OCCUPIED';
    }

    // 2. Check if there are owner assignments
    const activeOwner = await this.db
      .select()
      .from(flatOwners)
      .where(eq(flatOwners.flatId, flatId));

    if (activeOwner.length > 0) {
      return 'OWNER_OCCUPIED';
    }

    return 'VACANT';
  }

  /**
   * Internal helper to record mutation audit logs.
   */
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

  async bulkCreate(dtos: any[], executorId?: string) {
    if (!dtos || dtos.length === 0) return { importedCount: 0 };
    
    let importedCount = 0;
    
    for (const dto of dtos) {
      try {
        const { buildingName, wingName, floorNumber, ...flatData } = dto;
        if (!buildingName || !wingName || floorNumber === undefined) {
          continue;
        }

        // 1. Resolve Building
        let hierarchy = await this.getLayoutHierarchy();
        let building = hierarchy.find(b => b.name.toLowerCase() === buildingName.toLowerCase());
        if (!building) {
          building = await this.createBuilding(buildingName) as any;
          building!.wings = [];
          hierarchy = await this.getLayoutHierarchy();
        }

        // 2. Resolve Wing
        let wing = hierarchy.find(b => b.id === building!.id)?.wings?.find(w => w.name.toLowerCase() === wingName.toLowerCase());
        if (!wing) {
          wing = await this.createWing(building!.id, wingName) as any;
          wing!.floors = [];
          hierarchy = await this.getLayoutHierarchy();
        }

        // 3. Resolve Floor
        let floor = hierarchy.find(b => b.id === building!.id)?.wings?.find(w => w.id === wing!.id)?.floors?.find(f => f.number === Number(floorNumber));
        if (!floor) {
          floor = await this.createFloor(wing!.id, Number(floorNumber));
        }

        // 4. Create Flat
        const createDto: CreateFlatDto = {
          floorId: floor.id,
          number: flatData.flatNumber,
          sqftArea: flatData.sqftArea ? Number(flatData.sqftArea) : (flatData.carpetArea ? Number(flatData.carpetArea) : 500),
          flatType: flatData.flatType || '2BHK',
          carpetArea: flatData.carpetArea ? Number(flatData.carpetArea) : undefined,
        };

        await this.create(createDto, executorId);
        importedCount++;
      } catch (err) {
        console.error('Failed to create flat in bulk:', err);
      }
    }

    await this.logAction({
      societyId: this.flatRepository['activeTenantId'],
      userId: executorId,
      action: 'FLAT_BULK_JSON_IMPORT',
      entityName: 'flats',
      newValues: { count: importedCount },
    });

    return { importedCount };
  }

  // ==========================================
  // Layout Master Configuration Methods
  // ==========================================

  async getLayoutHierarchy() {
    return this.flatRepository.getLayoutHierarchy();
  }

  async createBuilding(name: string) {
    if (!name || name.trim() === '') {
      throw new BadRequestException('Building name is required.');
    }
    return this.flatRepository.createBuilding(name);
  }

  async createWing(buildingId: string, name: string) {
    if (!name || name.trim() === '') {
      throw new BadRequestException('Wing name is required.');
    }
    if (!buildingId) {
      throw new BadRequestException('Building ID is required to create a wing.');
    }
    return this.flatRepository.createWing(buildingId, name);
  }

  async createFloor(wingId: string, number: number) {
    if (number === undefined || number === null) {
      throw new BadRequestException('Floor number is required.');
    }
    if (!wingId) {
      throw new BadRequestException('Wing ID is required to create a floor.');
    }
    return this.flatRepository.createFloor(wingId, number);
  }

  async updateBuilding(id: string, name: string) {
    if (!name || name.trim() === '') {
      throw new BadRequestException('Building name is required.');
    }
    return this.flatRepository.updateBuilding(id, name);
  }

  async updateWing(id: string, name: string) {
    if (!name || name.trim() === '') {
      throw new BadRequestException('Wing name is required.');
    }
    return this.flatRepository.updateWing(id, name);
  }

  async updateFloor(id: string, number: number) {
    if (number === undefined || number === null) {
      throw new BadRequestException('Floor number is required.');
    }
    return this.flatRepository.updateFloor(id, number);
  }
}
