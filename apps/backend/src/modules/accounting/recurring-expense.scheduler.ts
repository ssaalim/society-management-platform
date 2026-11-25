import { Injectable, Logger, OnApplicationBootstrap, OnModuleDestroy } from '@nestjs/common';
import { ClsService } from 'nestjs-cls';
import { RecurringExpenseService } from './recurring-expense.service';

/** Longest delay setTimeout accepts (~24.8 days); longer waits are chained without touching the database. */
const MAX_DELAY = 2_147_483_647;
/** Delay before catching up on periods that were already due when the server started. */
const OVERDUE_DELAY = 20_000;

/** 06:00 IST on the given date, as epoch milliseconds. */
function dueAt(date: string): number {
  return Date.parse(`${date}T06:00:00+05:30`);
}

/**
 * Drafts due recurring expenses without polling. At start-up it asks the database once for the earliest due date across
 * all societies, then sleeps until 06:00 IST that day. After each run it asks again. Creating or editing a template moves
 * the timer earlier when needed, without a query. So on days when nothing is due the database is never touched.
 *
 * If the server is asleep or restarted at the due time, the start-up check and the once-a-day check when someone opens
 * Accounting (RecurringExpenseService.ensureUpToDate) catch up. Set RECURRING_EXPENSES_SCHEDULER=off to disable the timer
 * (for example on extra API instances; running on several is still safe because each period is drafted at most once).
 */
@Injectable()
export class RecurringExpenseScheduler implements OnApplicationBootstrap, OnModuleDestroy {
  private readonly logger = new Logger(RecurringExpenseScheduler.name);
  private timer: NodeJS.Timeout | null = null;
  /** The due date the timer is set for, or null when nothing is scheduled. */
  private nextDue: string | null = null;
  private running = false;
  private enabled = false;

  constructor(
    private readonly service: RecurringExpenseService,
    private readonly cls: ClsService,
  ) {}

  onApplicationBootstrap() {
    if (process.env.RECURRING_EXPENSES_SCHEDULER === 'off' || process.env.NODE_ENV === 'test') return;
    this.enabled = true;
    this.service.onScheduleChanged = (date) => this.hint(date);
    this.refresh().catch((err) => this.logger.error(`Could not schedule recurring expenses: ${err?.message}`));
  }

  onModuleDestroy() {
    this.enabled = false;
    if (this.timer) clearTimeout(this.timer);
  }

  /** A template now falls due on `date`: wake earlier if that is sooner than the current timer. */
  private hint(date: string) {
    if (!this.enabled || this.running) return; // a running tick re-reads the schedule when it finishes
    if (this.nextDue && this.nextDue <= date) return;
    this.arm(date);
  }

  /** Reads the earliest due date (one query) and sets the timer for it. */
  private async refresh(afterRun = false) {
    const next = await this.service.nextDueDate();
    if (!this.enabled) return;
    if (!next) {
      this.nextDue = null;
      if (this.timer) clearTimeout(this.timer);
      this.timer = null;
      this.logger.log('No recurring expenses scheduled; the timer is idle.');
      return;
    }
    // Still due right after a run means a society keeps failing: retry hourly rather than spinning.
    this.arm(next, afterRun ? 60 * 60 * 1000 : OVERDUE_DELAY);
  }

  private arm(date: string, overdueDelay = OVERDUE_DELAY) {
    if (this.timer) clearTimeout(this.timer);
    this.nextDue = date;
    const wait = dueAt(date) - Date.now();
    if (wait <= 0) {
      this.timer = setTimeout(() => this.tick(), overdueDelay);
    } else if (wait > MAX_DELAY) {
      this.timer = setTimeout(() => this.arm(date), MAX_DELAY);
    } else {
      this.timer = setTimeout(() => this.tick(), wait);
      this.logger.log(`Next recurring expense check: ${date} 06:00 IST.`);
    }
  }

  async tick() {
    if (this.running) return;
    this.running = true;
    this.timer = null;
    try {
      const societies = await this.service.societiesWithDueTemplates();
      for (const societyId of societies) {
        try {
          const result = await this.cls.run(async () => {
            this.cls.set('tenantId', societyId);
            return this.service.runDueForSociety(societyId);
          });
          if (result.drafted > 0) {
            this.logger.log(`Society ${societyId}: drafted ${result.drafted} recurring expense(s), posted ${result.posted}.`);
          }
        } catch (err: any) {
          this.logger.error(`Recurring expenses failed for society ${societyId}: ${err?.message}`);
        }
      }
    } catch (err: any) {
      this.logger.error(`Recurring expense run failed: ${err?.message}`);
    } finally {
      this.running = false;
    }
    try {
      await this.refresh(true);
    } catch (err: any) {
      // Don't spin on a database outage: try again in an hour.
      this.logger.error(`Could not reschedule recurring expenses: ${err?.message}`);
      if (this.enabled) this.timer = setTimeout(() => this.tick(), 60 * 60 * 1000);
    }
  }
}
