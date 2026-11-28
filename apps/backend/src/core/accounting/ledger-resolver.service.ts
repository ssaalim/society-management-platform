import { BadRequestException, Inject, Injectable } from '@nestjs/common';
import { ClsService } from 'nestjs-cls';
import { and, asc, desc, eq, inArray, like } from 'drizzle-orm';
import { DRIZZLE_PROVIDER, DrizzleDB } from '@core/database/database.module';
import { bankAccounts, ledgers } from '../../../database/schema';

export type Ledger = typeof ledgers.$inferSelect;

type LedgerGroup = 'ASSETS' | 'LIABILITIES' | 'EQUITY' | 'INCOME' | 'EXPENSES';

/**
 * Ledgers the app posts to automatically. `names` are the names this role has been created under (the first is used
 * for new societies); an existing ledger with one of them is adopted and tagged with the key the first time it is needed.
 */
export const SYSTEM_LEDGERS = {
  CASH: { group: 'ASSETS', prefix: 'CASH', names: ['Cash in Hand Account', 'Cash in Hand'] },
  RECEIVABLES: { group: 'ASSETS', prefix: 'REC', names: ['Maintenance Dues Receivables', 'Maintenance Receivables'] },
  MAINTENANCE_INCOME: { group: 'INCOME', prefix: 'INC', names: ['Maintenance Charges Income', 'Maintenance Income'] },
  VENDOR_PAYABLES: { group: 'LIABILITIES', prefix: 'PAY', names: ['Vendor & Service Payables'] },
  GST_OUTPUT: { group: 'LIABILITIES', prefix: 'GST', names: ['GST Output Payable'] },
  REFUNDS: { group: 'EXPENSES', prefix: 'EXP', names: ['Refunds to Members', 'Refund Expense Accounts'] },
  RESERVE_SURPLUS: { group: 'EQUITY', prefix: 'EQU', names: ['Accumulated General Reserve Surplus', 'Retained Earnings Reserves'] },
  /** Fund shares issued but not yet paid (funds kept on the accrual basis). */
  FUND_RECEIVABLES: { group: 'ASSETS', prefix: 'REC', names: ['Fund Contributions Receivable'] },
  /** Funds used to buy fixed assets (generator, solar panels) move here from the fund. */
  CAPITAL_RESERVE: { group: 'LIABILITIES', prefix: 'RES', names: ['Capital Reserve (Assets from Funds)'] },
  /** Refundable deposits collected (hall booking, shifting) until they are refunded. */
  DEPOSITS: { group: 'LIABILITIES', prefix: 'DEP', names: ['Refundable Deposits Held'] },
  /** Only used when a society has no bank account set up yet. */
  BANK_FALLBACK: { group: 'ASSETS', prefix: 'BANK', names: ['Bank Account - Main'] },
} as const satisfies Record<string, { group: LedgerGroup; prefix: string; names: readonly string[] }>;

export type SystemLedgerKey = keyof typeof SYSTEM_LEDGERS;

/** Where money came from or went: cash, or a bank (a specific account, else the society's default). */
export interface MoneySource {
  mode?: string | null;
  bankAccountId?: string | null;
}

/**
 * Finds the ledgers postings go to, for the society in the request context. Unlike looking ledgers up by a fixed name,
 * it never creates a ledger under a guessed group: bank postings use the real bank account's ledger, system ledgers are
 * found by role, and expense or income heads are created only under their own group.
 */
@Injectable()
export class LedgerResolver {
  constructor(
    @Inject(DRIZZLE_PROVIDER) private readonly db: DrizzleDB,
    private readonly cls: ClsService,
  ) {}

  private get societyId(): string {
    const id = this.cls.get<string>('tenantId');
    if (!id) throw new BadRequestException('Society context is missing.');
    return id;
  }

  /** The cash ledger for CASH, otherwise the chosen bank account's ledger (or the default bank account's). */
  async money(source: MoneySource): Promise<Ledger & { bankAccountId: string | null }> {
    if ((source.mode || '').toUpperCase() === 'CASH') return { ...(await this.system('CASH')), bankAccountId: null };
    return this.bank(source.bankAccountId);
  }

  /** The ledger of a bank account of this society; without one, the default (or only) bank account. */
  async bank(bankAccountId?: string | null): Promise<Ledger & { bankAccountId: string | null }> {
    const societyId = this.societyId;
    const where = bankAccountId
      ? and(eq(bankAccounts.id, bankAccountId), eq(bankAccounts.societyId, societyId))
      : eq(bankAccounts.societyId, societyId);
    const [row] = await this.db
      .select({ ledger: ledgers, bankAccountId: bankAccounts.id })
      .from(bankAccounts)
      .innerJoin(ledgers, eq(ledgers.id, bankAccounts.ledgerId))
      .where(where)
      .orderBy(desc(bankAccounts.isDefault), asc(bankAccounts.createdAt))
      .limit(1);
    if (row) return { ...row.ledger, bankAccountId: row.bankAccountId };
    if (bankAccountId) throw new BadRequestException('That bank account is not part of this society.');
    // No bank account set up yet: use the society's general bank ledger.
    return { ...(await this.system('BANK_FALLBACK')), bankAccountId: null };
  }

  /** The society's bank accounts to pay from or deposit into (account numbers masked), default first. */
  async bankAccounts() {
    const rows = await this.db
      .select({
        id: bankAccounts.id,
        bankName: bankAccounts.bankName,
        accountNumber: bankAccounts.accountNumber,
        isDefault: bankAccounts.isDefault,
        ledgerName: ledgers.name,
      })
      .from(bankAccounts)
      .innerJoin(ledgers, eq(ledgers.id, bankAccounts.ledgerId))
      .where(eq(bankAccounts.societyId, this.societyId))
      .orderBy(desc(bankAccounts.isDefault), asc(bankAccounts.createdAt));
    return rows.map(({ accountNumber, ...r }) => ({ ...r, last4: accountNumber.slice(-4) }));
  }

  /** A system ledger by role; adopts an existing ledger with a known name, else creates it. */
  async system(key: SystemLedgerKey): Promise<Ledger> {
    const societyId = this.societyId;
    const def = SYSTEM_LEDGERS[key];
    const [tagged] = await this.db
      .select()
      .from(ledgers)
      .where(and(eq(ledgers.societyId, societyId), eq(ledgers.systemKey, key)));
    if (tagged) return tagged;

    const named = await this.db
      .select()
      .from(ledgers)
      .where(and(eq(ledgers.societyId, societyId), eq(ledgers.group, def.group), inArray(ledgers.name, [...def.names])))
      .orderBy(asc(ledgers.createdAt));
    const existing = def.names.map((n) => named.find((l) => l.name === n)).find(Boolean);
    if (existing) {
      // Tag it; if another request tagged a ledger meanwhile, use that one.
      try {
        const [row] = await this.db.update(ledgers).set({ systemKey: key }).where(eq(ledgers.id, existing.id)).returning();
        return row;
      } catch {
        return this.system(key);
      }
    }

    const [created] = await this.db
      .insert(ledgers)
      .values({ societyId, name: def.names[0], group: def.group, code: await this.nextCode(def.prefix), systemKey: key })
      .onConflictDoNothing()
      .returning();
    return created || this.system(key);
  }

  /** The expense ledger (expense head) with this name, created under EXPENSES if it doesn't exist. */
  expense(name: string): Promise<Ledger> {
    return this.head(name, 'EXPENSES', 'EXP', 'expense');
  }

  /** The income ledger with this name, created under INCOME if it doesn't exist. */
  income(name: string): Promise<Ledger> {
    return this.head(name, 'INCOME', 'INC', 'income');
  }

  /** A fixed-asset ledger (e.g. "Generator"), created under ASSETS if it doesn't exist. */
  asset(name: string): Promise<Ledger> {
    return this.head(name, 'ASSETS', 'AST', 'asset');
  }

  /** A fund ledger (e.g. "Generator Fund") held for a purpose, created under LIABILITIES if it doesn't exist. */
  fund(name: string): Promise<Ledger> {
    return this.head(name, 'LIABILITIES', 'FND', 'fund');
  }

  private async head(name: string, group: LedgerGroup, prefix: string, label: string): Promise<Ledger> {
    const societyId = this.societyId;
    const clean = name.trim();
    if (!clean) throw new BadRequestException(`Choose an ${label} head.`);
    const [existing] = await this.db
      .select()
      .from(ledgers)
      .where(and(eq(ledgers.societyId, societyId), eq(ledgers.name, clean)));
    if (existing) {
      if (existing.group !== group) throw new BadRequestException(`"${clean}" is not an ${label} account.`);
      return existing;
    }
    const [created] = await this.db
      .insert(ledgers)
      .values({ societyId, name: clean, group, code: await this.nextCode(prefix) })
      .returning();
    return created;
  }

  /** The next free code with this prefix in the society: EXP-04 after EXP-03. */
  async nextCode(prefix: string): Promise<string> {
    const rows = await this.db
      .select({ code: ledgers.code })
      .from(ledgers)
      .where(and(eq(ledgers.societyId, this.societyId), like(ledgers.code, `${prefix}-%`)));
    const max = rows.reduce((m, r) => Math.max(m, Number(r.code?.slice(prefix.length + 1)) || 0), 0);
    return `${prefix}-${String(max + 1).padStart(2, '0')}`;
  }
}
