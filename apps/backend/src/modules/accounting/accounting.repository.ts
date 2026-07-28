import { Injectable, Inject } from '@nestjs/common';
import { TenantBaseRepository } from '@core/database/base.repository';
import { 
  vouchers, 
  transactions, 
  ledgers,
  expenses,
  vendors
} from '../../../database/schema';
import { DRIZZLE_PROVIDER, DrizzleDB } from '@core/database/database.module';
import { ClsService } from 'nestjs-cls';
import { eq, and, sql, desc } from 'drizzle-orm';

@Injectable()
export class AccountingRepository extends TenantBaseRepository<typeof vouchers> {
  constructor(
    @Inject(DRIZZLE_PROVIDER) protected readonly db: DrizzleDB,
    protected readonly cls: ClsService,
  ) {
    super(db, cls, vouchers);
  }

  /**
   * Retrieves a single voucher with nested journal entries.
   */
  async findVoucherDetails(id: string) {
    const record = await this.db
      .select()
      .from(vouchers)
      .where(
        and(
          eq(vouchers.id, id),
          eq(vouchers.societyId, this.activeTenantId)
        )
      );

    if (record.length === 0) return null;

    const lines = await this.db
      .select({
        id: transactions.id,
        ledgerId: transactions.ledgerId,
        ledgerName: ledgers.name,
        ledgerCode: ledgers.code,
        ledgerGroup: ledgers.group,
        type: transactions.type,
        amount: transactions.amount,
      })
      .from(transactions)
      .innerJoin(ledgers, eq(transactions.ledgerId, ledgers.id))
      .where(eq(transactions.voucherId, id));

    return {
      ...record[0],
      lines,
    };
  }

  /**
   * Searches and filters vouchers.
   */
  async searchVouchers(filters: { type?: string }) {
    const whereClauses = [eq(vouchers.societyId, this.activeTenantId)];
    if (filters.type) {
      whereClauses.push(eq(vouchers.type, filters.type as any));
    }

    const voucherList = await this.db
      .select()
      .from(vouchers)
      .where(and(...whereClauses))
      .orderBy(desc(vouchers.createdAt));

    const enriched = await Promise.all(
      voucherList.map(async (v) => {
        const lines = await this.db
          .select({
            id: transactions.id,
            ledgerId: transactions.ledgerId,
            ledgerName: ledgers.name,
            ledgerCode: ledgers.code,
            type: transactions.type,
            amount: transactions.amount,
          })
          .from(transactions)
          .innerJoin(ledgers, eq(transactions.ledgerId, ledgers.id))
          .where(eq(transactions.voucherId, v.id));

        const totalAmount = lines
          .filter((l) => l.type === 'DEBIT')
          .reduce((sum, l) => sum + Number(l.amount || 0), 0);

        return {
          ...v,
          totalAmount: totalAmount.toFixed(2),
          lines,
        };
      })
    );

    return enriched;
  }

  /**
   * Fetches all registered society expenditure & vendor bills logs.
   */
  async searchExpenses() {
    return this.db
      .select({
        id: expenses.id,
        billNumber: expenses.billNumber,
        amount: expenses.amount,
        date: expenses.date,
        status: expenses.status,
        approvalStatus: expenses.approvalStatus,
        vendorId: expenses.vendorId,
        vendorName: vendors.name,
        voucherId: expenses.voucherId,
        voucherNumber: vouchers.voucherNumber,
        createdAt: expenses.createdAt,
      })
      .from(expenses)
      .leftJoin(vendors, eq(expenses.vendorId, vendors.id))
      .leftJoin(vouchers, eq(expenses.voucherId, vouchers.id))
      .where(eq(expenses.societyId, this.activeTenantId))
      .orderBy(desc(expenses.date), desc(expenses.createdAt));
  }

  /**
   * Aggregates debits and credits totals grouped by ALL society ledgers.
   */
  async getTransactionsLedgerSummary() {
    return this.db
      .select({
        ledgerId: ledgers.id,
        ledgerName: ledgers.name,
        ledgerCode: ledgers.code,
        ledgerGroup: ledgers.group,
        totalDebit: sql<string>`coalesce(sum(case when ${transactions.type} = 'DEBIT' then ${transactions.amount}::numeric else 0 end), 0)`,
        totalCredit: sql<string>`coalesce(sum(case when ${transactions.type} = 'CREDIT' then ${transactions.amount}::numeric else 0 end), 0)`,
      })
      .from(ledgers)
      .leftJoin(transactions, eq(ledgers.id, transactions.ledgerId))
      .where(eq(ledgers.societyId, this.activeTenantId))
      .groupBy(ledgers.id, ledgers.name, ledgers.code, ledgers.group);
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
}
