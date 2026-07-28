import { Injectable, NotFoundException, Inject, BadRequestException } from '@nestjs/common';
import { AccountingRepository } from './accounting.repository';
import { CreateVoucherDto } from './dto/create-voucher.dto';
import { DRIZZLE_PROVIDER, DrizzleDB } from '@core/database/database.module';
import { 
  auditLogs, 
  vouchers, 
  transactions, 
  ledgers,
  expenses
} from '../../../database/schema';
import { eq, and } from 'drizzle-orm';

import { NotificationService } from '../notification/notification.service';

@Injectable()
export class AccountingService {
  constructor(
    private readonly accountingRepository: AccountingRepository,
    @Inject(DRIZZLE_PROVIDER) private readonly db: DrizzleDB,
    private readonly notificationService: NotificationService,
  ) {}

  /**
   * Posts double-entry journal vouchers to ledgers.
   */
  async createVoucher(dto: CreateVoucherDto, executorId?: string) {
    const activeTenantId = this.accountingRepository['activeTenantId'];

    // 1. Verify double-entry balancing
    let debitSum = 0;
    let creditSum = 0;

    dto.lines.forEach((line) => {
      if (line.type === 'DEBIT') {
        debitSum += line.amount;
      } else {
        creditSum += line.amount;
      }
    });

    // Enforce matching totals with float rounding tolerance (0.01 paise)
    if (Math.abs(debitSum - creditSum) > 0.01) {
      throw new BadRequestException(
        `Out of Balance: Total debits (₹${debitSum}) must equal total credits (₹${creditSum}).`
      );
    }

    let voucherRecord: any = null;

    // 2. Commit transaction
    await this.db.transaction(async (tx) => {
      const voucherId = require('crypto').randomUUID();
      const newVouchers = await tx.insert(vouchers).values({
        id: voucherId,
        societyId: activeTenantId,
        voucherNumber: dto.voucherNumber,
        type: dto.type as any,
        date: dto.date,
        narration: dto.narration || null,
      }).returning();

      voucherRecord = newVouchers[0];

      // Insert transaction line items
      await Promise.all(
        dto.lines.map((line) =>
          tx.insert(transactions).values({
            id: require('crypto').randomUUID(),
            societyId: activeTenantId,
            voucherId: voucherRecord.id,
            ledgerId: line.ledgerId,
            type: line.type,
            amount: line.amount.toString(),
          })
        )
      );
    });

    await this.logAction({
      societyId: activeTenantId,
      userId: executorId,
      action: 'VOUCHER_POST',
      entityName: 'vouchers',
      entityId: voucherRecord?.id,
      newValues: voucherRecord,
    });

    // Notify President, Treasurer, & Accountant
    await this.notificationService.notifyRoles(
      ['PRESIDENT', 'SECRETARY', 'TREASURER', 'ACCOUNTANT'],
      '📜 New Accounting Voucher Posted',
      `Journal Voucher ${voucherRecord.voucherNumber} (${voucherRecord.type}) posted. Narration: ${voucherRecord.narration || 'N/A'}`
    );

    return voucherRecord;
  }

  async findAll(filters: { type?: string }) {
    return this.accountingRepository.searchVouchers(filters);
  }

  async findOne(id: string) {
    const details = await this.accountingRepository.findVoucherDetails(id);
    if (!details) {
      throw new NotFoundException('Voucher record not found in this society.');
    }
    return details;
  }

  async getExpenses() {
    return this.accountingRepository.searchExpenses();
  }

  async createExpense(dto: {
    vendorName?: string;
    billNumber: string;
    expenseHeadName: string;
    amount: number;
    date: string;
    paymentMode?: string;
    status?: 'PAID' | 'UNPAID';
  }, executorId?: string) {
    const activeTenantId = this.accountingRepository['activeTenantId'];

    const expenseLedger = await this.accountingRepository.findLedgerByName(dto.expenseHeadName || 'Repairs & Building Maintenance');

    const creditLedger = dto.status === 'PAID'
      ? (dto.paymentMode === 'CASH'
          ? await this.accountingRepository.findLedgerByName('Cash in Hand Account')
          : await this.accountingRepository.findLedgerByName('Bank Account SBI'))
      : await this.accountingRepository.findLedgerByName('Vendor & Service Payables');

    const voucherNumber = `VOU-EXP-${Date.now()}`;
    const voucherRecord = await this.createVoucher({
      voucherNumber,
      type: dto.status === 'PAID' ? 'PAYMENT' : 'JOURNAL',
      date: dto.date,
      narration: `Expenditure for Bill ${dto.billNumber} (${dto.vendorName || 'General Vendor'})`,
      lines: [
        { ledgerId: expenseLedger.id, type: 'DEBIT', amount: Number(dto.amount) },
        { ledgerId: creditLedger.id, type: 'CREDIT', amount: Number(dto.amount) },
      ],
    }, executorId);

    const expenseRecord = await this.db.insert(expenses).values({
      id: require('crypto').randomUUID(),
      societyId: activeTenantId,
      voucherId: voucherRecord.id,
      billNumber: dto.billNumber,
      amount: Number(dto.amount).toFixed(2),
      date: dto.date,
      status: dto.status || 'PAID',
      approvalStatus: 'APPROVED',
    }).returning();

    return expenseRecord[0];
  }

  /**
   * Generates Trial Balance aggregates.
   */
  async getTrialBalance() {
    const summary = await this.accountingRepository.getTransactionsLedgerSummary();
    
    let totalDebitSum = 0;
    let totalCreditSum = 0;

    const list = summary.map((s) => {
      const debit = Number(s.totalDebit) || 0;
      const credit = Number(s.totalCredit) || 0;

      totalDebitSum += debit;
      totalCreditSum += credit;

      return {
        ledgerId: s.ledgerId,
        ledgerName: s.ledgerName,
        ledgerCode: s.ledgerCode || '',
        ledgerGroup: s.ledgerGroup,
        debit,
        credit,
        netBalance: Number((debit - credit).toFixed(2)),
      };
    });

    return {
      list,
      totals: {
        debit: Number(totalDebitSum.toFixed(2)),
        credit: Number(totalCreditSum.toFixed(2)),
        isBalanced: Math.abs(totalDebitSum - totalCreditSum) < 0.05,
      },
    };
  }

  /**
   * Generates Income & Expenditure statements.
   */
  async getIncomeExpenditure() {
    const trialBalance = await this.getTrialBalance();
    
    const incomeItems = trialBalance.list.filter((l) => l.ledgerGroup === 'INCOME');
    const expenseItems = trialBalance.list.filter((l) => l.ledgerGroup === 'EXPENSES');

    const totalIncome = incomeItems.reduce((acc, item) => acc + item.credit, 0);
    const totalExpenses = expenseItems.reduce((acc, item) => acc + item.debit, 0);
    
    return {
      income: incomeItems,
      expenditure: expenseItems,
      summary: {
        totalIncome: Number(totalIncome.toFixed(2)),
        totalExpenses: Number(totalExpenses.toFixed(2)),
        surplus: Number((totalIncome - totalExpenses).toFixed(2)),
      },
    };
  }

  /**
   * Generates Balance Sheets statements.
   */
  async getBalanceSheet() {
    const trialBalance = await this.getTrialBalance();
    const ieStatement = await this.getIncomeExpenditure();

    const assetItems = trialBalance.list.filter((l) => l.ledgerGroup === 'ASSETS');
    const liabilityItems = trialBalance.list.filter((l) => l.ledgerGroup === 'LIABILITIES' || l.ledgerGroup === 'EQUITY');

    const netSurplus = ieStatement.summary.surplus;

    const totalAssets = assetItems.reduce((acc, item) => acc + item.netBalance, 0);
    const totalLiabilitiesRaw = liabilityItems.reduce((acc, item) => acc + Math.abs(item.netBalance), 0);
    const totalLiabilitiesAndReserves = totalLiabilitiesRaw + netSurplus;

    return {
      assets: assetItems,
      liabilities: liabilityItems,
      currentYearSurplus: netSurplus,
      summary: {
        totalAssets: Number(totalAssets.toFixed(2)),
        totalLiabilities: Number(totalLiabilitiesAndReserves.toFixed(2)),
        isBalanced: Math.abs(totalAssets - totalLiabilitiesAndReserves) < 0.05,
      },
    };
  }

  /**
   * Automates Financial Year end closing adjustments.
   */
  async closeFinancialYear(executorId?: string) {
    const activeTenantId = this.accountingRepository['activeTenantId'];

    // 1. Calculate current surplus
    const statements = await this.getIncomeExpenditure();
    const surplus = statements.summary.surplus;

    if (surplus === 0) return { success: true, narration: 'No surplus to carry forward.' };

    const surplusLedger = await this.accountingRepository.findLedgerByName('Maintenance Income');
    const reservesLedger = await this.accountingRepository.findLedgerByName('Retained Earnings Reserves');

    // 2. Post closing journal voucher inside transaction block
    let closingVoucher: any = null;

    await this.db.transaction(async (tx) => {
      const voucherId = require('crypto').randomUUID();
      
      const newVouchers = await tx.insert(vouchers).values({
        id: voucherId,
        societyId: activeTenantId,
        voucherNumber: `CLV-${Date.now()}`,
        type: 'JOURNAL',
        date: new Date().toISOString().substring(0, 10),
        narration: `Financial Year closing entry carrying forward net surplus of ₹${surplus} to Retained Earnings Reserves.`,
      }).returning();

      closingVoucher = newVouchers[0];

      // Debit Maintenance Income Account (to clear to 0.00)
      await tx.insert(transactions).values({
        id: require('crypto').randomUUID(),
        societyId: activeTenantId,
        voucherId,
        ledgerId: surplusLedger.id,
        type: 'DEBIT',
        amount: surplus.toString(),
      });

      // Credit Reserves Account (carrying forward to Balance Sheet)
      await tx.insert(transactions).values({
        id: require('crypto').randomUUID(),
        societyId: activeTenantId,
        voucherId,
        ledgerId: reservesLedger.id,
        type: 'CREDIT',
        amount: surplus.toString(),
      });
    });

    await this.logAction({
      societyId: activeTenantId,
      userId: executorId,
      action: 'FINANCIAL_YEAR_CLOSE',
      entityName: 'vouchers',
      entityId: closingVoucher?.id,
      newValues: closingVoucher,
    });

    return { success: true, voucher: closingVoucher };
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
