import { Inject, Injectable, Logger } from '@nestjs/common';
import { desc, eq, isNull, sql } from 'drizzle-orm';
import { DRIZZLE_PROVIDER, DrizzleDB } from '@core/database/database.module';
import { errorLogs } from '../../../database/schema';
import { classifyError, errorCode } from './error-catalog';

export interface ErrorOccurrence {
  source: 'SERVER' | 'CLIENT';
  level: 'error' | 'crash';
  message: string;
  where?: string | null;
  stack?: string | null;
  requestId?: string | null;
  userId?: string | null;
  societyId?: string | null;
  page?: string | null;
  version?: string | null;
  userAgent?: string | null;
  steps?: string[] | null;
  context?: Record<string, unknown> | null;
  /** Use this code instead of computing one (the browser already showed it to the user). */
  code?: string | null;
}

/** Extra details, kept small: anything too big is stored as truncated text. */
function contextOf(ctx: Record<string, unknown> | null | undefined): unknown {
  if (!ctx) return null;
  const text = JSON.stringify(ctx);
  return text.length > 3000 ? `${text.slice(0, 3000)}…` : ctx;
}

/** Same error repeated within this window is written once (a loop must not flood the database). */
const THROTTLE_MS = 5_000;
const KEEP_SAMPLES = 10;

/**
 * Records errors grouped by code: one upsert per error (count + last occurrences), throttled per code, never throwing.
 * Support looks codes up in the platform console (Errors).
 */
@Injectable()
export class ErrorLogService {
  private readonly logger = new Logger(ErrorLogService.name);
  private readonly lastWrite = new Map<string, number>();

  constructor(@Inject(DRIZZLE_PROVIDER) private readonly db: DrizzleDB) {}

  codeFor(message: string, where?: string | null) {
    return errorCode(message, where || '');
  }

  /** Saves the occurrence; returns its code. Never throws: logging must not cause a second error. */
  async record(o: ErrorOccurrence): Promise<string> {
    const code = o.code && /^E-[0-9A-F]{4}$/.test(o.code) ? o.code : this.codeFor(o.message, o.where);
    const now = Date.now();
    if (now - (this.lastWrite.get(code) || 0) < THROTTLE_MS) return code;
    this.lastWrite.set(code, now);
    if (this.lastWrite.size > 2000) this.lastWrite.clear();

    const sample = {
      at: new Date(now).toISOString(),
      requestId: o.requestId || null,
      userId: o.userId || null,
      societyId: o.societyId || null,
      page: o.page || null,
      version: o.version || null,
      userAgent: o.userAgent ? o.userAgent.slice(0, 200) : null,
      steps: (o.steps || []).slice(-15),
      context: contextOf(o.context),
    };
    try {
      await this.db
        .insert(errorLogs)
        .values({
          code,
          source: o.source,
          level: o.level,
          knownProblem: classifyError(o.message)?.id || null,
          message: o.message.slice(0, 2000),
          where: o.where?.slice(0, 300) || null,
          stack: o.stack?.slice(0, 4000) || null,
          samples: sql`${JSON.stringify([sample])}::text::jsonb`,
        })
        .onConflictDoUpdate({
          target: errorLogs.code,
          set: {
            count: sql`${errorLogs.count} + 1`,
            lastSeen: new Date(now),
            message: o.message.slice(0, 2000),
            stack: sql`coalesce(${o.stack?.slice(0, 4000) || null}, ${errorLogs.stack})`,
            // Keep the newest few occurrences.
            samples: sql`(select coalesce(jsonb_agg(x), '[]'::jsonb) from (
              select x from jsonb_array_elements(jsonb_build_array(${JSON.stringify(sample)}::text::jsonb) || ${errorLogs.samples}) x limit ${KEEP_SAMPLES}
            ) t)`,
            // A problem that comes back after being marked fixed is open again.
            resolvedAt: null,
          },
        });
    } catch (err: any) {
      this.logger.warn(`Could not save error ${code}: ${err?.message}`);
    }
    return code;
  }

  async list(opts: { open?: boolean; search?: string }) {
    const rows = await this.db
      .select()
      .from(errorLogs)
      .where(
        sql`true ${opts.open ? sql`and ${errorLogs.resolvedAt} is null` : sql``} ${
          opts.search ? sql`and (${errorLogs.code} ilike ${'%' + opts.search + '%'} or ${errorLogs.message} ilike ${'%' + opts.search + '%'} or ${errorLogs.samples}::text ilike ${'%' + opts.search + '%'})` : sql``
        }`,
      )
      .orderBy(desc(errorLogs.lastSeen))
      .limit(200);
    return rows.map((r) => ({ ...r, help: classifyError(r.message) ? { id: classifyError(r.message)!.id, title: classifyError(r.message)!.title } : null }));
  }

  async setResolved(code: string, resolved: boolean) {
    const [row] = await this.db
      .update(errorLogs)
      .set({ resolvedAt: resolved ? new Date() : null })
      .where(eq(errorLogs.code, code))
      .returning({ code: errorLogs.code, resolvedAt: errorLogs.resolvedAt });
    return row || null;
  }

  async openCount() {
    const [r] = await this.db.select({ n: sql<number>`count(*)::int` }).from(errorLogs).where(isNull(errorLogs.resolvedAt));
    return r.n;
  }
}
