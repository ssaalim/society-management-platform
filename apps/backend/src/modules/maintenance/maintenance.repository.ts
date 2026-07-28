import { Injectable, Inject } from '@nestjs/common';
import { TenantBaseRepository } from '@core/database/base.repository';
import { 
  maintenanceBills, 
  billItems, 
  flats, 
  floors, 
  wings, 
  buildings, 
  receipts, 
  ledgers,
  maintenanceHeads,
  userSocieties,
  roles,
  flatOwners,
  owners,
  flatTenants,
  tenants
} from '../../../database/schema';
import { DRIZZLE_PROVIDER, DrizzleDB } from '@core/database/database.module';
import { ClsService } from 'nestjs-cls';
import { eq, and, like, inArray, desc } from 'drizzle-orm';

@Injectable()
export class MaintenanceRepository extends TenantBaseRepository<typeof maintenanceBills> {
  constructor(
    @Inject(DRIZZLE_PROVIDER) protected readonly db: DrizzleDB,
    protected readonly cls: ClsService,
  ) {
    super(db, cls, maintenanceBills);
  }

  private formatMonthYear(dateStr?: string) {
    if (!dateStr) return 'N/A';
    try {
      const d = new Date(dateStr);
      return d.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
    } catch (e) {
      return dateStr;
    }
  }

  /**
   * Retrieves a single bill invoice complete detailed profile.
   */
  async findBillDetails(id: string) {
    const records = await this.db
      .select({
        bill: maintenanceBills,
        flatNumber: flats.number,
        floorNumber: floors.number,
        wingName: wings.name,
        buildingName: buildings.name,
      })
      .from(maintenanceBills)
      .innerJoin(flats, eq(maintenanceBills.flatId, flats.id))
      .innerJoin(floors, eq(flats.floorId, floors.id))
      .innerJoin(wings, eq(floors.wingId, wings.id))
      .innerJoin(buildings, eq(wings.buildingId, buildings.id))
      .where(
        and(
          eq(maintenanceBills.id, id),
          eq(maintenanceBills.societyId, this.activeTenantId)
        )
      );

    if (records.length === 0) return null;

    const details = records[0];

    const items = await this.db
      .select({
        id: billItems.id,
        amount: billItems.amount,
        headId: billItems.headId,
        name: maintenanceHeads.name,
      })
      .from(billItems)
      .leftJoin(maintenanceHeads, eq(billItems.headId, maintenanceHeads.id))
      .where(eq(billItems.billId, id));

    const flatReceipts = await this.db
      .select({
        id: receipts.id,
        receiptNumber: receipts.receiptNumber,
        amountPaid: receipts.amountPaid,
        paymentMode: receipts.paymentMode,
        referenceNumber: receipts.referenceNumber,
        paymentDate: receipts.paymentDate,
        billNumber: maintenanceBills.billNumber,
        billingPeriodStart: maintenanceBills.billingPeriodStart,
        billingPeriodEnd: maintenanceBills.billingPeriodEnd,
        totalBillAmount: maintenanceBills.totalAmount,
        billStatus: maintenanceBills.status,
      })
      .from(receipts)
      .innerJoin(maintenanceBills, eq(receipts.billId, maintenanceBills.id))
      .where(eq(maintenanceBills.flatId, details.bill.flatId))
      .orderBy(desc(receipts.paymentDate), desc(receipts.createdAt))
      .limit(5);

    const formattedReceipts = flatReceipts.map((r) => ({
      ...r,
      monthYear: this.formatMonthYear(r.billingPeriodStart),
      paymentType: Number(r.amountPaid || 0) >= Number(r.totalBillAmount || 0) ? 'FULL' : 'PARTIAL',
    }));

    const billReceipts = formattedReceipts.filter((r) => r.billNumber === details.bill.billNumber);
    const totalPaid = billReceipts.reduce((sum, r) => sum + Number(r.amountPaid || 0), 0);
    const invoiceTotal = Number(details.bill.totalAmount || 0);
    const remainingBalance = Math.max(0, invoiceTotal - totalPaid);
    const lastPayment = formattedReceipts.length > 0 ? formattedReceipts[0] : null;

    return {
      ...details.bill,
      amount: details.bill.totalAmount,
      totalPaid: totalPaid.toFixed(2),
      remainingBalance: remainingBalance.toFixed(2),
      lastPayment,
      recentReceipts: formattedReceipts,
      periodStart: details.bill.billingPeriodStart,
      periodEnd: details.bill.billingPeriodEnd,
      flatNumber: details.flatNumber,
      floorNumber: details.floorNumber,
      wingName: details.wingName,
      buildingName: details.buildingName,
      items: items.map((i) => ({ ...i, name: i.name || 'Maintenance Line Item' })),
      receipts: billReceipts,
    };
  }

  /**
   * Searches and filters maintenance bills based on query parameters.
   */
  async searchBills(filters: {
    search?: string;
    status?: string;
    userId?: string;
    mine?: boolean;
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

    const whereClauses = [eq(maintenanceBills.societyId, this.activeTenantId)];

    if (filters.status) {
      whereClauses.push(eq(maintenanceBills.status, filters.status));
    }
    if (filters.search) {
      whereClauses.push(like(flats.number, `%${filters.search}%`));
    }

    let userFlatIds: string[] = [];
    if (filters.userId) {
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

      userFlatIds = [
        ...ownedFlats.map((f) => f.flatId),
        ...rentedFlats.map((f) => f.flatId),
      ];
    }

    if ((filters.mine || ['OWNER', 'TENANT'].includes(userRoleName)) && filters.userId) {
      if (userFlatIds.length > 0) {
        whereClauses.push(inArray(maintenanceBills.flatId, userFlatIds));
      } else {
        return [];
      }
    }

    const rawBills = await this.db
      .select({
        id: maintenanceBills.id,
        flatId: maintenanceBills.flatId,
        billNumber: maintenanceBills.billNumber,
        flatNumber: flats.number,
        buildingName: buildings.name,
        periodStart: maintenanceBills.billingPeriodStart,
        periodEnd: maintenanceBills.billingPeriodEnd,
        dueDate: maintenanceBills.dueDate,
        amount: maintenanceBills.totalAmount,
        status: maintenanceBills.status,
      })
      .from(maintenanceBills)
      .innerJoin(flats, eq(maintenanceBills.flatId, flats.id))
      .innerJoin(floors, eq(flats.floorId, floors.id))
      .innerJoin(wings, eq(floors.wingId, wings.id))
      .innerJoin(buildings, eq(wings.buildingId, buildings.id))
      .where(and(...whereClauses));

    const enriched = await Promise.all(
      rawBills.map(async (b) => {
        const flatReceipts = await this.db
          .select({
            id: receipts.id,
            receiptNumber: receipts.receiptNumber,
            amountPaid: receipts.amountPaid,
            paymentMode: receipts.paymentMode,
            referenceNumber: receipts.referenceNumber,
            paymentDate: receipts.paymentDate,
            billNumber: maintenanceBills.billNumber,
            billingPeriodStart: maintenanceBills.billingPeriodStart,
            billingPeriodEnd: maintenanceBills.billingPeriodEnd,
            totalBillAmount: maintenanceBills.totalAmount,
            billStatus: maintenanceBills.status,
          })
          .from(receipts)
          .innerJoin(maintenanceBills, eq(receipts.billId, maintenanceBills.id))
          .where(eq(maintenanceBills.flatId, b.flatId))
          .orderBy(desc(receipts.paymentDate), desc(receipts.createdAt))
          .limit(5);

        const formattedReceipts = flatReceipts.map((r) => ({
          ...r,
          monthYear: this.formatMonthYear(r.billingPeriodStart),
          paymentType: Number(r.amountPaid || 0) >= Number(r.totalBillAmount || 0) ? 'FULL' : 'PARTIAL',
        }));

        const thisBillReceipts = formattedReceipts.filter((r) => r.billNumber === b.billNumber);
        const totalPaid = thisBillReceipts.reduce((sum, r) => sum + Number(r.amountPaid || 0), 0);
        const invoiceTotal = Number(b.amount || 0);
        const remainingBalance = Math.max(0, invoiceTotal - totalPaid);

        return {
          ...b,
          totalPaid: totalPaid.toFixed(2),
          remainingBalance: remainingBalance.toFixed(2),
          lastPayment: formattedReceipts.length > 0 ? formattedReceipts[0] : null,
          recentReceipts: formattedReceipts,
          isMine: userFlatIds.includes(b.flatId),
        };
      })
    );

    return enriched;
  }

  /**
   * Resolves double-entry ledger by name in active society scope.
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

    const code = name.toLowerCase().includes('cash')
      ? 'CASH-01'
      : name.toLowerCase().includes('bank')
      ? 'BANK-01'
      : name.toLowerCase().includes('income')
      ? 'INC-01'
      : name.toLowerCase().includes('receivables')
      ? 'REC-01'
      : 'GEN-01';

    const group = (name.includes('Income') ? 'INCOME' : name.includes('Receivables') || name.includes('Cash') || name.includes('Bank') ? 'ASSETS' : 'LIABILITIES') as any;

    const newLedgers = await this.db.insert(ledgers).values({
      id: require('crypto').randomUUID(),
      societyId: this.activeTenantId,
      name,
      code,
      group,
    }).returning();

    return newLedgers[0];
  }

  /**
   * Resolves a billing category category head ID by name.
   */
  async findOrCreateHead(name: string) {
    const existing = await this.db
      .select()
      .from(maintenanceHeads)
      .where(
        and(
          eq(maintenanceHeads.name, name),
          eq(maintenanceHeads.societyId, this.activeTenantId)
        )
      );

    if (existing.length > 0) return existing[0];

    const ledger = await this.findLedgerByName(`${name} Income`);

    const newHeads = await this.db.insert(maintenanceHeads).values({
      id: require('crypto').randomUUID(),
      societyId: this.activeTenantId,
      name,
      ledgerId: ledger.id,
    }).returning();

    return newHeads[0];
  }
}
