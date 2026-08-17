import { Injectable, Inject } from '@nestjs/common';
import { 
  flats, 
  members, 
  maintenanceBills, 
  visitors, 
  vehicles, 
  polls, 
  pollVotes,
  documents,
  owners,
  flatOwners,
  tenants,
  flatTenants
} from '../../../database/schema';
import { DRIZZLE_PROVIDER, DrizzleDB } from '@core/database/database.module';
import { ClsService } from 'nestjs-cls';
import { eq, and, desc, sql } from 'drizzle-orm';

@Injectable()
export class ResidentRepository {
  constructor(
    @Inject(DRIZZLE_PROVIDER) private readonly db: DrizzleDB,
    private readonly cls: ClsService,
  ) {}

  private get activeTenantId() {
    return this.cls.get<string>('tenantId');
  }

  /**
   * Resolves flat details mapped to this resident user ID.
   */
  async findResidentFlatDetails(userId: string) {
    // 1. Search in flatOwners/owners registry
    const ownerRecord = await this.db
      .select({
        ownerId: owners.id,
        flatId: flatOwners.flatId,
        flatNumber: flats.number,
      })
      .from(owners)
      .innerJoin(flatOwners, eq(flatOwners.ownerId, owners.id))
      .innerJoin(flats, eq(flatOwners.flatId, flats.id))
      .where(
        and(
          eq(owners.userId, userId),
          eq(owners.societyId, this.activeTenantId)
        )
      );

    if (ownerRecord.length > 0) {
      return {
        memberId: ownerRecord[0].ownerId,
        flatId: ownerRecord[0].flatId,
        flatNumber: ownerRecord[0].flatNumber,
        role: 'OWNER',
      };
    }

    // 2. Search in flatTenants/tenants registry
    const tenantRecord = await this.db
      .select({
        tenantId: tenants.id,
        flatId: flatTenants.flatId,
        flatNumber: flats.number,
      })
      .from(tenants)
      .innerJoin(flatTenants, eq(flatTenants.tenantId, tenants.id))
      .innerJoin(flats, eq(flatTenants.flatId, flats.id))
      .where(
        and(
          eq(tenants.userId, userId),
          eq(tenants.societyId, this.activeTenantId),
          eq(flatTenants.isActive, true)
        )
      );

    if (tenantRecord.length > 0) {
      return {
        memberId: tenantRecord[0].tenantId,
        flatId: tenantRecord[0].flatId,
        flatNumber: tenantRecord[0].flatNumber,
        role: 'TENANT',
      };
    }

    // 3. Fallback: Search in members table
    const memberRecord = await this.db
      .select({
        memberId: members.id,
        role: members.memberType,
      })
      .from(members)
      .where(
        and(
          eq(members.userId, userId),
          eq(members.societyId, this.activeTenantId)
        )
      );

    if (memberRecord.length > 0) {
      // Find any flat in society if exists or null
      const firstFlat = await this.db
        .select({ id: flats.id, number: flats.number })
        .from(flats)
        .where(eq(flats.societyId, this.activeTenantId))
        .limit(1);

      return {
        memberId: memberRecord[0].memberId,
        flatId: firstFlat[0]?.id || null,
        flatNumber: firstFlat[0]?.number || null,
        role: memberRecord[0].role || 'OWNER',
      };
    }

    return null;
  }

  async getOutstandingDues(flatId: string) {
    if (!flatId) return 0;
    const summary = await this.db
      .select({
        totalOutstanding: sql<string>`sum(${maintenanceBills.totalAmount}::numeric)`,
      })
      .from(maintenanceBills)
      .where(
        and(
          eq(maintenanceBills.flatId, flatId),
          eq(maintenanceBills.status, 'UNPAID')
        )
      );

    return Number(summary[0]?.totalOutstanding) || 0;
  }

  async getVisitorsLog(flatId: string) {
    if (!flatId) return [];
    return this.db
      .select()
      .from(visitors)
      .where(eq(visitors.flatId, flatId))
      .orderBy(desc(visitors.createdAt));
  }

  // ==========================================
  // VEHICLES
  // ==========================================

  async getVehiclesLog(flatId: string) {
    if (!flatId) return [];
    return this.db
      .select()
      .from(vehicles)
      .where(eq(vehicles.flatId, flatId))
      .orderBy(desc(vehicles.createdAt));
  }

  async getAllSocietyVehicles() {
    return this.db
      .select({
        id: vehicles.id,
        number: vehicles.number,
        type: vehicles.type,
        make: vehicles.make,
        model: vehicles.model,
        flatId: vehicles.flatId,
        flatNumber: flats.number,
        createdAt: vehicles.createdAt,
      })
      .from(vehicles)
      .innerJoin(flats, eq(vehicles.flatId, flats.id))
      .where(eq(vehicles.societyId, this.activeTenantId))
      .orderBy(desc(vehicles.createdAt));
  }

  async addVehicle(data: {
    flatId: string;
    number: string;
    type: string;
    make?: string;
    model?: string;
  }) {
    const newRecord = await this.db.insert(vehicles).values({
      id: require('crypto').randomUUID(),
      societyId: this.activeTenantId,
      flatId: data.flatId,
      number: data.number.toUpperCase().trim(),
      type: data.type || 'FOUR_WHEELER',
      make: data.make || null,
      model: data.model || null,
    }).returning();
    return newRecord[0];
  }

  async deleteVehicle(id: string, flatId?: string) {
    const conditions = [
      eq(vehicles.id, id),
      eq(vehicles.societyId, this.activeTenantId),
    ];
    if (flatId) {
      conditions.push(eq(vehicles.flatId, flatId));
    }
    const res = await this.db.delete(vehicles).where(and(...conditions)).returning();
    return res[0] || null;
  }

  // ==========================================
  // CIRCULARS & SHARED DOCUMENTS
  // ==========================================

  async getDocuments() {
    return this.db
      .select()
      .from(documents)
      .where(eq(documents.societyId, this.activeTenantId))
      .orderBy(desc(documents.createdAt));
  }

  async addDocument(data: {
    name: string;
    category: string;
    fileUrl: string;
    fileSize?: number;
    isPrivate?: boolean;
  }) {
    const newDoc = await this.db.insert(documents).values({
      id: require('crypto').randomUUID(),
      societyId: this.activeTenantId,
      name: data.name.trim(),
      category: data.category || 'CIRCULAR',
      fileUrl: data.fileUrl,
      fileSize: data.fileSize || 0,
      isPrivate: data.isPrivate || false,
    }).returning();
    return newDoc[0];
  }

  async deleteDocument(id: string) {
    const res = await this.db
      .delete(documents)
      .where(and(eq(documents.id, id), eq(documents.societyId, this.activeTenantId)))
      .returning();
    return res[0] || null;
  }

  // ==========================================
  // GENERAL BODY PROPOSALS & POLLS
  // ==========================================

  async getActivePolls(memberId?: string) {
    const activePollList = await this.db
      .select()
      .from(polls)
      .where(eq(polls.societyId, this.activeTenantId))
      .orderBy(desc(polls.createdAt));

    const pollIds = activePollList.map((p) => p.id);
    if (pollIds.length === 0) return [];

    // Fetch all votes for these polls
    const votes = await this.db
      .select()
      .from(pollVotes);

    return activePollList.map((p) => {
      const pVotes = votes.filter((v) => v.pollId === p.id);
      const yesVotes = pVotes.filter((v) => v.choice === 'YES').length;
      const noVotes = pVotes.filter((v) => v.choice === 'NO').length;
      const abstainVotes = pVotes.filter((v) => v.choice === 'ABSTAIN').length;
      const userVote = memberId ? pVotes.find((v) => v.memberId === memberId)?.choice : null;

      return {
        ...p,
        totalVotes: pVotes.length,
        yesVotes,
        noVotes,
        abstainVotes,
        hasVoted: !!userVote,
        userVote,
      };
    });
  }

  async createPoll(data: {
    question: string;
    description?: string;
    endDate: string;
    status?: string;
  }) {
    const newPoll = await this.db.insert(polls).values({
      id: require('crypto').randomUUID(),
      societyId: this.activeTenantId,
      question: data.question.trim(),
      description: data.description?.trim() || null,
      endDate: data.endDate as any,
      status: data.status || 'ACTIVE',
    }).returning();
    return newPoll[0];
  }

  async deletePoll(id: string) {
    const res = await this.db
      .delete(polls)
      .where(and(eq(polls.id, id), eq(polls.societyId, this.activeTenantId)))
      .returning();
    return res[0] || null;
  }

  async checkHasVoted(pollId: string, memberId: string) {
    const checks = await this.db
      .select()
      .from(pollVotes)
      .where(
        and(
          eq(pollVotes.pollId, pollId),
          eq(pollVotes.memberId, memberId)
        )
      );

    return checks.length > 0;
  }
}
