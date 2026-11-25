import { Injectable, Logger, OnApplicationBootstrap, OnModuleDestroy, Inject } from '@nestjs/common';
import { ClsService } from 'nestjs-cls';
import { sql } from 'drizzle-orm';
import { DRIZZLE_PROVIDER, DrizzleDB } from '@core/database/database.module';
import { MeetingAccess } from './meeting-access.service';
import { MeetingService } from './meeting.service';
import { ResolutionService } from './resolution.service';

const MAX_DELAY = 2_147_483_647; // longest setTimeout (~24.8 days); longer waits chain without a query
const RETRY_MS = 60 * 60 * 1000;

/**
 * Sends the day-before reminders (meetings, voting deadlines) without polling. It asks the database once for the next
 * reminder due across all societies, sleeps until then, sends what is due, and asks again. Sending a notice, moving a
 * meeting, or opening / extending a vote moves the timer earlier without a query. A day with nothing due costs nothing.
 * Safe on several servers: each reminder is claimed with a conditional update before it is sent.
 * Set MEETING_REMINDERS=off to disable (e.g. on extra API instances).
 */
@Injectable()
export class MeetingRemindersScheduler implements OnApplicationBootstrap, OnModuleDestroy {
  private readonly logger = new Logger(MeetingRemindersScheduler.name);
  private timer: NodeJS.Timeout | null = null;
  private nextAt: number | null = null;
  private running = false;
  private enabled = false;

  constructor(
    @Inject(DRIZZLE_PROVIDER) private readonly db: DrizzleDB,
    private readonly cls: ClsService,
    private readonly access: MeetingAccess,
    private readonly meetings: MeetingService,
    private readonly resolutions: ResolutionService,
  ) {}

  onApplicationBootstrap() {
    if (process.env.MEETING_REMINDERS === 'off' || process.env.NODE_ENV === 'test') return;
    this.enabled = true;
    this.access.onReminderChanged = (at) => this.hint(at.getTime());
    this.refresh().catch((err) => this.logger.error(`Could not schedule reminders: ${err?.message}`));
  }

  onModuleDestroy() {
    this.enabled = false;
    if (this.timer) clearTimeout(this.timer);
  }

  private hint(at: number) {
    if (!this.enabled || this.running) return; // a running tick re-reads the schedule afterwards
    if (this.nextAt !== null && this.nextAt <= at) return;
    this.arm(at);
  }

  /** One query: the earliest reminder still to send. */
  private async refresh(afterRun = false) {
    const [row] = (await this.db.execute(sql`
      select min(t) as next from (
        select scheduled_at - interval '24 hours' as t from meetings
          where status = 'SCHEDULED' and reminder_sent_at is null and scheduled_at > now()
        union all
        select voting_deadline - interval '24 hours' from meeting_resolutions
          where status = 'OPEN' and reminder_sent_at is null and voting_deadline > now()
      ) x
    `)) as unknown as { next: string | Date | null }[];
    if (!this.enabled) return;
    if (!row?.next) {
      this.nextAt = null;
      if (this.timer) clearTimeout(this.timer);
      this.timer = null;
      return;
    }
    const at = new Date(row.next).getTime();
    // Still due right after a run means something keeps failing: try again later rather than spinning.
    this.arm(afterRun && at <= Date.now() ? Date.now() + RETRY_MS : at);
  }

  private arm(at: number) {
    if (this.timer) clearTimeout(this.timer);
    this.nextAt = at;
    const wait = Math.max(5_000, at - Date.now());
    this.timer = wait > MAX_DELAY ? setTimeout(() => this.arm(at), MAX_DELAY) : setTimeout(() => this.tick(), wait);
  }

  async tick() {
    if (this.running) return;
    this.running = true;
    this.timer = null;
    try {
      // Claim what is due, so another server doesn't send it too.
      const dueMeetings = (await this.db.execute(sql`
        update meetings set reminder_sent_at = now()
        where status = 'SCHEDULED' and reminder_sent_at is null and scheduled_at > now() and scheduled_at - interval '24 hours' <= now()
        returning *
      `)) as unknown as any[];
      const dueVotes = (await this.db.execute(sql`
        update meeting_resolutions set reminder_sent_at = now()
        where status = 'OPEN' and reminder_sent_at is null and voting_deadline > now() and voting_deadline - interval '24 hours' <= now()
        returning *
      `)) as unknown as any[];
      for (const raw of dueMeetings) {
        const m = camel(raw);
        await this.inSociety(m.societyId, () => this.meetings.sendMeetingReminder(m)).then((n) => this.logger.log(`Reminder for meeting ${m.id} sent to ${n}.`));
      }
      for (const raw of dueVotes) {
        const r = camel(raw);
        await this.inSociety(r.societyId, () => this.resolutions.sendVoteReminder(r)).then((n) => this.logger.log(`Vote reminder for resolution ${r.id} sent to ${n}.`));
      }
    } catch (err: any) {
      this.logger.error(`Reminder run failed: ${err?.message}`);
    } finally {
      this.running = false;
    }
    try {
      await this.refresh(true);
    } catch (err: any) {
      this.logger.error(`Could not reschedule reminders: ${err?.message}`);
      if (this.enabled) this.timer = setTimeout(() => this.tick(), RETRY_MS);
    }
  }

  private inSociety<T>(societyId: string, fn: () => Promise<T>): Promise<T | 0> {
    return this.cls
      .run(async () => {
        this.cls.set('tenantId', societyId);
        return fn();
      })
      .catch((err: any) => {
        this.logger.error(`Reminder failed for society ${societyId}: ${err?.message}`);
        return 0 as const;
      });
  }
}

/** Raw rows come back snake_case; the services expect the schema's camelCase fields. */
function camel(row: Record<string, any>): any {
  const out: Record<string, any> = {};
  for (const [k, v] of Object.entries(row)) out[k.replace(/_([a-z])/g, (_, c) => c.toUpperCase())] = v;
  return out;
}
