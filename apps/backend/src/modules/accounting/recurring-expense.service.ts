import { BadRequestException, ConflictException, Inject, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { ClsService } from 'nestjs-cls';
import { and, asc, desc, eq, inArray, isNull, lte, or, sql } from 'drizzle-orm';
import { randomUUID } from 'crypto';
import { DRIZZLE_PROVIDER, DrizzleDB } from '@core/database/database.module';
import { auditLogs, expenses, ledgers, recurringExpenses, staff, staffSalaries, transactions, vouchers } from '../../../database/schema';
import { LedgerResolver } from '@core/accounting/ledger-resolver.service';
import { NotificationService } from '../notification/notification.service';
import { PostDraftDto, RecurringExpenseDto } from './dto/recurring-expense.dto';

export type RecurringExpense = typeof recurringExpenses.$inferSelect;

const FREQUENCY_MONTHS: Record<string, number> = { MONTHLY: 1, QUARTERLY: 3, HALF_YEARLY: 6, YEARLY: 12 };
/** Most periods drafted in one go for one template, so a start date far in the past can't flood the drafts. */
const MAX_CATCH_UP = 12;
const REVIEWER_ROLES = ['PRESIDENT', 'SECRETARY', 'TREASURER', 'ACCOUNTANT'];

/** Active templates with a period still to draft (not past their end date). */
const pending = () =>
  and(
    eq(recurringExpenses.isActive, true),
    or(isNull(recurringExpenses.endDate), lte(recurringExpenses.nextRunDate, recurringExpenses.endDate)),
  );

/** Today in India (societies are Indian), as YYYY-MM-DD. */
export function todayIST(): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata' }).format(new Date());
}

/** The expense date for the period starting `monthOffset` months after the template's start month. */
function periodDate(startDate: string, dayOfMonth: number, monthOffset: number): string {
  const [y, m] = startDate.split('-').map(Number);
  const total = y * 12 + (m - 1) + monthOffset;
  const year = Math.floor(total / 12);
  const month = (total % 12) + 1;
  return `${year}-${String(month).padStart(2, '0')}-${String(dayOfMonth).padStart(2, '0')}`;
}

const periodKeyOf = (date: string) => date.slice(0, 7);

/** The first period date of a template whose period is after `afterPeriodKey` (or the very first period). */
function firstPeriodAfter(t: Pick<RecurringExpense, 'startDate' | 'dayOfMonth' | 'frequency'>, afterPeriodKey: string | null): string {
  const step = FREQUENCY_MONTHS[t.frequency] || 1;
  for (let i = 0; i < 1200; i++) {
    const d = periodDate(t.startDate, t.dayOfMonth, i * step);
    if (!afterPeriodKey || periodKeyOf(d) > afterPeriodKey) return d;
  }
  throw new BadRequestException('Could not work out the schedule.');
}

/** "Nov 2026", or "Nov 2026 – Jan 2027" for longer periods. */
function periodLabel(periodKey: string, frequency: string): string {
  const fmt = (key: string) => {
    const [y, m] = key.split('-').map(Number);
    return new Date(Date.UTC(y, m - 1, 1)).toLocaleString('en-IN', { month: 'short', year: 'numeric', timeZone: 'UTC' });
  };
  const months = FREQUENCY_MONTHS[frequency] || 1;
  if (months === 1) return fmt(periodKey);
  const end = periodDate(`${periodKey}-01`, 1, months - 1);
  return `${fmt(periodKey)} – ${fmt(periodKeyOf(end))}`;
}

/**
 * Recurring expenses (guard and sweeper salaries, electricity, lift AMC, ...): each template drafts one expense per
 * period. Drafts wait in the review list until the accountant confirms the actual amount, which posts the voucher;
 * fixed-amount templates can be set to post automatically.
 */
@Injectable()
export class RecurringExpenseService {
  private readonly logger = new Logger(RecurringExpenseService.name);
  /** Set by the scheduler: told whenever a template's next due date may have moved earlier. */
  onScheduleChanged?: (nextRunDate: string) => void;
  /** Society id -> the IST date its due templates were last checked (in memory, so the check costs nothing after). */
  private readonly checkedOn = new Map<string, string>();

  constructor(
    @Inject(DRIZZLE_PROVIDER) private readonly db: DrizzleDB,
    private readonly cls: ClsService,
    private readonly ledgerResolver: LedgerResolver,
    private readonly notificationService: NotificationService,
  ) {}

  private get societyId(): string {
    const id = this.cls.get<string>('tenantId');
    if (!id) throw new BadRequestException('Society context is missing.');
    return id;
  }

  // ---------------------------------------------------------------- templates

  async list() {
    const rows = await this.db
      .select({ template: recurringExpenses, staffName: staff.name, staffSalary: staff.salary })
      .from(recurringExpenses)
      .leftJoin(staff, eq(recurringExpenses.staffId, staff.id))
      .where(eq(recurringExpenses.societyId, this.societyId))
      .orderBy(desc(recurringExpenses.isActive), asc(recurringExpenses.nextRunDate), asc(recurringExpenses.name));
    return rows.map((r) => ({ ...r.template, staffName: r.staffName, staffSalary: r.staffSalary }));
  }

  async get(id: string): Promise<RecurringExpense> {
    const [row] = await this.db
      .select()
      .from(recurringExpenses)
      .where(and(eq(recurringExpenses.id, id), eq(recurringExpenses.societyId, this.societyId)));
    if (!row) throw new NotFoundException('Recurring expense not found.');
    return row;
  }

  private async assertStaff(staffId: string | null) {
    if (!staffId) return;
    const [row] = await this.db
      .select({ id: staff.id })
      .from(staff)
      .where(and(eq(staff.id, staffId), eq(staff.societyId, this.societyId)));
    if (!row) throw new BadRequestException('That staff member is not part of this society.');
  }

  private toRow(dto: RecurringExpenseDto) {
    return {
      name: dto.name,
      expenseHead: dto.expenseHead,
      vendorName: dto.vendorName || null,
      staffId: dto.staffId,
      amountType: dto.amountType,
      amount: dto.amount.toFixed(2),
      frequency: dto.frequency,
      dayOfMonth: dto.dayOfMonth,
      startDate: dto.startDate,
      endDate: dto.endDate,
      autoPost: dto.amountType === 'VARIABLE' ? false : dto.autoPost,
      postAs: dto.postAs,
      paymentMode: dto.paymentMode,
      bankAccountId: dto.paymentMode === 'BANK' ? dto.bankAccountId : null,
      notes: dto.notes,
      isActive: dto.isActive,
      updatedAt: new Date(),
    };
  }

  async create(dto: RecurringExpenseDto, userId?: string) {
    await this.assertStaff(dto.staffId);
    if (dto.paymentMode === 'BANK' && dto.bankAccountId) await this.ledgerResolver.bank(dto.bankAccountId);
    await this.expenseLedger(dto.expenseHead);
    const nextRunDate = firstPeriodAfter({ startDate: dto.startDate, dayOfMonth: dto.dayOfMonth, frequency: dto.frequency }, null);
    const [row] = await this.db
      .insert(recurringExpenses)
      .values({ ...this.toRow(dto), societyId: this.societyId, nextRunDate, createdBy: userId || null })
      .returning();
    await this.audit(userId, 'RECURRING_EXPENSE_CREATE', row.id, row);
    // Periods already due (start date today or earlier) are drafted straight away.
    const run = await this.runDueForSociety(this.societyId);
    const saved = await this.get(row.id);
    if (saved.isActive) this.onScheduleChanged?.(saved.nextRunDate);
    return { ...saved, drafted: run.drafted, posted: run.posted };
  }

  async update(id: string, dto: RecurringExpenseDto, userId?: string) {
    const current = await this.get(id);
    await this.assertStaff(dto.staffId);
    if (dto.paymentMode === 'BANK' && dto.bankAccountId) await this.ledgerResolver.bank(dto.bankAccountId);
    await this.expenseLedger(dto.expenseHead);

    let nextRunDate = current.nextRunDate;
    const scheduleChanged =
      current.startDate !== dto.startDate || current.dayOfMonth !== dto.dayOfMonth || current.frequency !== dto.frequency;
    const lastKey = current.lastRunDate ? periodKeyOf(current.lastRunDate) : null;
    if (scheduleChanged) nextRunDate = firstPeriodAfter(dto, lastKey);
    // Resuming a paused template starts from the current month instead of drafting every missed period.
    if (!current.isActive && dto.isActive) {
      const thisMonth = periodKeyOf(todayIST());
      const prev = periodKeyOf(periodDate(`${thisMonth}-01`, 1, -1));
      nextRunDate = firstPeriodAfter(dto, lastKey && lastKey > prev ? lastKey : prev);
    }

    const [row] = await this.db
      .update(recurringExpenses)
      .set({ ...this.toRow(dto), nextRunDate })
      .where(and(eq(recurringExpenses.id, id), eq(recurringExpenses.societyId, this.societyId)))
      .returning();
    await this.audit(userId, 'RECURRING_EXPENSE_UPDATE', id, row);
    const run = row.isActive ? await this.runDueForSociety(this.societyId) : { drafted: 0, posted: 0 };
    const saved = await this.get(id);
    if (saved.isActive) this.onScheduleChanged?.(saved.nextRunDate);
    return { ...saved, drafted: run.drafted, posted: run.posted };
  }

  /** Deletes the template and its unreviewed drafts; expenses already posted stay in the books. */
  async remove(id: string, userId?: string) {
    await this.get(id);
    await this.db.transaction(async (tx) => {
      await tx
        .delete(expenses)
        .where(and(eq(expenses.societyId, this.societyId), eq(expenses.recurringExpenseId, id), inArray(expenses.status, ['DRAFT', 'SKIPPED'])));
      await tx.delete(recurringExpenses).where(and(eq(recurringExpenses.id, id), eq(recurringExpenses.societyId, this.societyId)));
    });
    await this.audit(userId, 'RECURRING_EXPENSE_DELETE', id, null);
    return { deleted: true };
  }

  // ---------------------------------------------------------------- drafting

  /** Expense heads to choose from: the society's expense ledgers. */
  async expenseHeads() {
    return this.db
      .select({ id: ledgers.id, name: ledgers.name, code: ledgers.code })
      .from(ledgers)
      .where(and(eq(ledgers.societyId, this.societyId), eq(ledgers.group, 'EXPENSES'), eq(ledgers.isActive, true)))
      .orderBy(asc(ledgers.code), asc(ledgers.name));
  }

  private expenseLedger(name: string) {
    return this.ledgerResolver.expense(name);
  }

  private async amountFor(t: RecurringExpense): Promise<number> {
    if (t.amountType === 'STAFF_SALARY' && t.staffId) {
      const [s] = await this.db.select({ salary: staff.salary }).from(staff).where(eq(staff.id, t.staffId));
      if (s && Number(s.salary) > 0) return Number(s.salary);
    }
    return Number(t.amount);
  }

  /**
   * Drafts every due period of the society's active templates (expense date on or before today), then advances each
   * template. Safe to run repeatedly or from several servers: a period is drafted at most once (unique index).
   */
  async runDueForSociety(societyId: string): Promise<{ drafted: number; posted: number }> {
    const today = todayIST();
    const due = await this.db
      .select()
      .from(recurringExpenses)
      .where(
        and(eq(recurringExpenses.societyId, societyId), pending(), lte(recurringExpenses.nextRunDate, today)),
      );
    this.checkedOn.set(societyId, today);

    let drafted = 0;
    let posted = 0;
    for (const t of due) {
      const step = FREQUENCY_MONTHS[t.frequency] || 1;
      let next = t.nextRunDate;
      let last = t.lastRunDate;
      for (let i = 0; i < MAX_CATCH_UP && next <= today && (!t.endDate || next <= t.endDate); i++) {
        const periodKey = periodKeyOf(next);
        const amount = await this.amountFor(t);
        const [draft] = await this.db
          .insert(expenses)
          .values({
            societyId,
            recurringExpenseId: t.id,
            periodKey,
            description: `${t.name} — ${periodLabel(periodKey, t.frequency)}`,
            expenseHead: t.expenseHead,
            paymentMode: t.paymentMode,
            amount: amount.toFixed(2),
            date: next,
            status: 'DRAFT',
            approvalStatus: 'PENDING',
          })
          .onConflictDoNothing()
          .returning();
        if (draft) {
          drafted++;
          if (t.autoPost && t.amountType !== 'VARIABLE' && amount > 0) {
            try {
              await this.postDraft(draft.id, { amount, date: next, billNumber: null, status: t.postAs as 'PAID' | 'UNPAID', paymentMode: t.paymentMode as 'BANK' | 'CASH', bankAccountId: t.bankAccountId }, undefined, { notify: false });
              posted++;
            } catch (err: any) {
              this.logger.warn(`Auto-post of ${t.name} ${periodKey} failed; left as a draft: ${err?.message}`);
            }
          }
        }
        last = next;
        next = periodDate(t.startDate, t.dayOfMonth, (this.monthsBetween(t.startDate, next) + step));
      }
      // Only advance if nobody else did in the meantime.
      await this.db
        .update(recurringExpenses)
        .set({ nextRunDate: next, lastRunDate: last, updatedAt: new Date() })
        .where(and(eq(recurringExpenses.id, t.id), eq(recurringExpenses.nextRunDate, t.nextRunDate)));
    }

    const toReview = drafted - posted;
    if (drafted > 0) {
      const parts = [];
      if (toReview > 0) parts.push(`${toReview} expense${toReview === 1 ? '' : 's'} ready for review`);
      if (posted > 0) parts.push(`${posted} posted automatically`);
      await this.notificationService.notifyRoles(
        REVIEWER_ROLES,
        'Recurring expenses',
        `${parts.join(', ')}. Open Accounting → Recurring Expenses.`,
      );
    }
    return { drafted, posted };
  }

  /**
   * Catch-up when someone opens Accounting: drafts anything due that the timer missed (server asleep or restarted).
   * Runs at most once per society per day, so repeat visits don't touch the database.
   */
  async ensureUpToDate() {
    const societyId = this.societyId;
    if (this.checkedOn.get(societyId) === todayIST()) return;
    try {
      await this.runDueForSociety(societyId);
    } catch (err: any) {
      this.logger.warn(`Catch-up for society ${societyId} failed: ${err?.message}`);
    }
  }

  /** Drafts what is due for the current society (the "Run now" button). */
  async runDueNow() {
    return this.runDueForSociety(this.societyId);
  }

  private monthsBetween(startDate: string, date: string): number {
    const [y1, m1] = startDate.split('-').map(Number);
    const [y2, m2] = date.split('-').map(Number);
    return (y2 - y1) * 12 + (m2 - m1);
  }

  /** Drafts waiting for review (and recently skipped ones). */
  async drafts() {
    return this.db
      .select({
        id: expenses.id,
        recurringExpenseId: expenses.recurringExpenseId,
        name: recurringExpenses.name,
        description: expenses.description,
        periodKey: expenses.periodKey,
        expenseHead: expenses.expenseHead,
        paymentMode: expenses.paymentMode,
        amount: expenses.amount,
        date: expenses.date,
        status: expenses.status,
        amountType: recurringExpenses.amountType,
        postAs: recurringExpenses.postAs,
        bankAccountId: recurringExpenses.bankAccountId,
        vendorName: recurringExpenses.vendorName,
      })
      .from(expenses)
      .leftJoin(recurringExpenses, eq(expenses.recurringExpenseId, recurringExpenses.id))
      .where(and(eq(expenses.societyId, this.societyId), eq(expenses.status, 'DRAFT')))
      .orderBy(asc(expenses.date), asc(recurringExpenses.name));
  }

  /** Expenses posted from a template, newest first. */
  async history(templateId: string) {
    await this.get(templateId);
    return this.db
      .select({
        id: expenses.id,
        periodKey: expenses.periodKey,
        amount: expenses.amount,
        date: expenses.date,
        status: expenses.status,
        billNumber: expenses.billNumber,
        voucherNumber: vouchers.voucherNumber,
      })
      .from(expenses)
      .leftJoin(vouchers, eq(expenses.voucherId, vouchers.id))
      .where(and(eq(expenses.societyId, this.societyId), eq(expenses.recurringExpenseId, templateId)))
      .orderBy(desc(expenses.periodKey))
      .limit(36);
  }

  /** Confirms a draft: posts the voucher (debit the expense head; credit bank/cash if paid, else vendor payables). */
  async postDraft(expenseId: string, dto: PostDraftDto, userId?: string, opts: { notify?: boolean } = {}) {
    const societyId = this.societyId;
    const [draft] = await this.db
      .select({ expense: expenses, template: recurringExpenses })
      .from(expenses)
      .leftJoin(recurringExpenses, eq(expenses.recurringExpenseId, recurringExpenses.id))
      .where(and(eq(expenses.id, expenseId), eq(expenses.societyId, societyId)));
    if (!draft) throw new NotFoundException('Expense not found.');
    if (draft.expense.status !== 'DRAFT') throw new ConflictException('This expense has already been posted or skipped.');

    const headName = dto.expenseHead || draft.expense.expenseHead || draft.template?.expenseHead || 'Repairs & Building Maintenance';
    const debit = await this.expenseLedger(headName);
    const paidFrom = dto.status === 'PAID' ? await this.ledgerResolver.money({ mode: dto.paymentMode, bankAccountId: dto.bankAccountId }) : null;
    const credit = paidFrom ?? (await this.ledgerResolver.system('VENDOR_PAYABLES'));

    const amount = Math.round(dto.amount * 100) / 100;
    const description = draft.expense.description || draft.template?.name || 'Recurring expense';
    const vendor = draft.template?.vendorName ? ` (${draft.template.vendorName})` : '';

    const voucher = await this.db.transaction(async (tx) => {
      // Lock the draft so two people confirming at once can't post it twice.
      const [locked] = await tx.select({ status: expenses.status }).from(expenses).where(eq(expenses.id, expenseId)).for('update');
      if (!locked || locked.status !== 'DRAFT') throw new ConflictException('This expense has already been posted or skipped.');

      const [v] = await tx
        .insert(vouchers)
        .values({
          societyId,
          voucherNumber: `VOU-EXP-${Date.now()}-${randomUUID().slice(0, 4).toUpperCase()}`,
          type: dto.status === 'PAID' ? 'PAYMENT' : 'JOURNAL',
          date: dto.date,
          narration: `${description}${vendor}${dto.billNumber ? `, bill ${dto.billNumber}` : ''}`,
        })
        .returning();
      await tx.insert(transactions).values([
        { societyId, voucherId: v.id, ledgerId: debit.id, type: 'DEBIT', amount: amount.toFixed(2) },
        { societyId, voucherId: v.id, ledgerId: credit.id, type: 'CREDIT', amount: amount.toFixed(2) },
      ]);
      await tx
        .update(expenses)
        .set({
          voucherId: v.id,
          amount: amount.toFixed(2),
          date: dto.date,
          billNumber: dto.billNumber,
          status: dto.status,
          approvalStatus: 'APPROVED',
          expenseHead: headName,
          paymentMode: dto.status === 'PAID' ? dto.paymentMode : null,
          bankAccountId: paidFrom?.bankAccountId ?? null,
          updatedAt: new Date(),
        })
        .where(eq(expenses.id, expenseId));

      // A paid salary also goes on the staff member's payroll record.
      const t = draft.template;
      if (t?.amountType === 'STAFF_SALARY' && t.staffId && dto.status === 'PAID' && draft.expense.periodKey) {
        const [year, month] = draft.expense.periodKey.split('-').map(Number);
        await tx.insert(staffSalaries).values({
          societyId,
          staffId: t.staffId,
          month,
          year,
          baseAmount: amount.toFixed(2),
          paidAt: new Date(`${dto.date}T12:00:00+05:30`),
          paymentMode: dto.paymentMode,
        });
      }
      return v;
    });

    await this.audit(userId, 'RECURRING_EXPENSE_POST', expenseId, { voucherNumber: voucher.voucherNumber, amount, status: dto.status });
    if (opts.notify !== false) {
      await this.notificationService.notifyRoles(
        REVIEWER_ROLES,
        'Recurring expense posted',
        `${description}: ₹${amount.toLocaleString('en-IN')} posted as ${dto.status === 'PAID' ? 'paid' : 'payable'} (${voucher.voucherNumber}).`,
      );
    }
    return { id: expenseId, voucherId: voucher.id, voucherNumber: voucher.voucherNumber, status: dto.status, amount };
  }

  /** Marks a draft as not needed this period (it will not be drafted again). */
  async skipDraft(expenseId: string, userId?: string) {
    const [row] = await this.db
      .update(expenses)
      .set({ status: 'SKIPPED', approvalStatus: 'REJECTED', updatedAt: new Date() })
      .where(and(eq(expenses.id, expenseId), eq(expenses.societyId, this.societyId), eq(expenses.status, 'DRAFT')))
      .returning({ id: expenses.id });
    if (!row) throw new ConflictException('Only expenses waiting for review can be skipped.');
    await this.audit(userId, 'RECURRING_EXPENSE_SKIP', expenseId, null);
    return { id: expenseId, status: 'SKIPPED' };
  }

  /** Societies with templates due today or earlier; used by the scheduler (no tenant context). */
  async societiesWithDueTemplates(): Promise<string[]> {
    const rows = await this.db
      .selectDistinct({ societyId: recurringExpenses.societyId })
      .from(recurringExpenses)
      .where(and(pending(), lte(recurringExpenses.nextRunDate, todayIST())));
    return rows.map((r) => r.societyId);
  }

  /** The earliest date any society has something due (null when nothing is scheduled); used by the scheduler. */
  async nextDueDate(): Promise<string | null> {
    const [row] = await this.db
      .select({ next: sql<string | null>`min(${recurringExpenses.nextRunDate})::text` })
      .from(recurringExpenses)
      .where(pending());
    return row?.next ?? null;
  }

  private async audit(userId: string | undefined, action: string, entityId: string, newValues: any) {
    try {
      await this.db.insert(auditLogs).values({
        societyId: this.societyId,
        userId: userId || null,
        action,
        entityName: 'recurring_expenses',
        entityId,
        newValues,
      } as any);
    } catch (err: any) {
      this.logger.warn(`Audit log failed: ${err?.message}`);
    }
  }
}
