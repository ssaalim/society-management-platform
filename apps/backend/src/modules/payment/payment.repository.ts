import { Injectable, Inject } from '@nestjs/common';
import { TenantBaseRepository } from '@core/database/base.repository';
import { 
  receipts, 
  maintenanceBills, 
  flats, 
  ledgers,
  userSocieties,
  roles,
  flatOwners,
  owners,
  flatTenants,
  tenants
} from '../../../database/schema';
import { DRIZZLE_PROVIDER, DrizzleDB } from '@core/database/database.module';
import { ClsService } from 'nestjs-cls';
import { eq, and, like, inArray } from 'drizzle-orm';

@Injectable()
export class PaymentRepository extends TenantBaseRepository<typeof receipts> {
  constructor(
    @Inject(DRIZZLE_PROVIDER) protected readonly db: DrizzleDB,
    protected readonly cls: ClsService,
  ) {
    super(db, cls, receipts);
  }

  /**
   * Fetches payment receipt detailed profile mapping.
   */
  async findReceiptDetails(id: string) {
    const records = await this.db
      .select({
        receipt: receipts,
        billNumber: maintenanceBills.billNumber,
        flatNumber: flats.number,
      })
      .from(receipts)
      .innerJoin(maintenanceBills, eq(receipts.billId, maintenanceBills.id))
      .innerJoin(flats, eq(maintenanceBills.flatId, flats.id))
      .where(
        and(
          eq(receipts.id, id),
          eq(receipts.societyId, this.activeTenantId)
        )
      );

    if (records.length === 0) return null;
    return records[0];
  }

  /**
   * Searches payment receipts in active society scope.
   * Scopes result list if the requesting user is an OWNER / TENANT.
   */
  async searchReceipts(filters: { search?: string; status?: string; userId?: string; mine?: boolean }) {
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

    const whereClauses = [eq(receipts.societyId, this.activeTenantId)];

    if (filters.status) {
      whereClauses.push(eq(receipts.status, filters.status as any));
    }

    // Role-based scoping: OWNER / TENANT role only sees receipts for their assigned flats
    if ((filters.mine || ['OWNER', 'TENANT'].includes(userRoleName)) && filters.userId) {
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
        whereClauses.push(inArray(maintenanceBills.flatId, userFlatIds));
      } else {
        return [];
      }
    }

    return this.db
      .select({
        id: receipts.id,
        receiptNumber: receipts.receiptNumber,
        amountPaid: receipts.amountPaid,
        paymentMode: receipts.paymentMode,
        paymentDate: receipts.paymentDate,
        referenceNumber: receipts.referenceNumber,
        status: receipts.status,
        refundedAmount: receipts.refundedAmount,
        cancellationReason: receipts.cancellationReason,
        approvedBy: receipts.approvedBy,
        rejectionReason: receipts.rejectionReason,
        userRemark: receipts.userRemark,
        billNumber: maintenanceBills.billNumber,
        flatNumber: flats.number,
      })
      .from(receipts)
      .innerJoin(maintenanceBills, eq(receipts.billId, maintenanceBills.id))
      .innerJoin(flats, eq(maintenanceBills.flatId, flats.id))
      .where(and(...whereClauses));
  }

  /**
   * Resolves a double-entry ledger by name.
   */
  async findLedgerByName(name: string) {
    const ledger = await this.db
      .select()
      .from(ledgers)
      .where(
        and(
          eq(ledgers.name, name),
          eq(ledgers.societyId, this.activeTenantId)
        )
      );

    if (ledger.length > 0) return ledger[0];

    const newLedgers = await this.db.insert(ledgers).values({
      id: require('crypto').randomUUID(),
      societyId: this.activeTenantId,
      name,
      group: name.includes('Income') ? 'INCOME' : name.includes('Receivables') ? 'ASSETS' : 'LIABILITIES',
    }).returning();

    return newLedgers[0];
  }
}
