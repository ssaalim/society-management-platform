import { Injectable, Inject } from '@nestjs/common';
import { 
  flats, 
  members, 
  maintenanceBills, 
  visitors, 
  vehicles, 
  polls, 
  pollVotes,
  owners,
  flatOwners,
  tenants,
  flatTenants
} from '../../../database/schema';
import { DRIZZLE_PROVIDER, DrizzleDB } from '@core/database/database.module';
import { ClsService } from 'nestjs-cls';
import { eq, and, sql } from 'drizzle-orm';

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
      })
      .from(owners)
      .innerJoin(flatOwners, eq(flatOwners.ownerId, owners.id))
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
        role: 'OWNER',
      };
    }

    // 2. Search in flatTenants/tenants registry
    const tenantRecord = await this.db
      .select({
        tenantId: tenants.id,
        flatId: flatTenants.flatId,
      })
      .from(tenants)
      .innerJoin(flatTenants, eq(flatTenants.tenantId, tenants.id))
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
        role: 'TENANT',
      };
    }

    return null;
  }

  async getOutstandingDues(flatId: string) {
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
    return this.db
      .select()
      .from(visitors)
      .where(eq(visitors.flatId, flatId));
  }

  async getVehiclesLog(flatId: string) {
    return this.db
      .select()
      .from(vehicles)
      .where(eq(vehicles.flatId, flatId));
  }

  async getActivePolls() {
    return this.db
      .select()
      .from(polls)
      .where(
        and(
          eq(polls.societyId, this.activeTenantId),
          eq(polls.status, 'ACTIVE')
        )
      );
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
