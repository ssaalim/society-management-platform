import { sql } from 'drizzle-orm';
import type { DrizzleDB } from '@core/database/database.module';

/**
 * Runs a user-written custom report query so that it can only ever see one society's rows.
 *
 * Inside a transaction that is always rolled back, every table in the public schema is shadowed by a temporary
 * view of the same name (temporary objects are resolved before public ones), then the transaction is switched to
 * read-only and the report runs:
 *   - tables with a society_id column show only that society's rows;
 *   - societies shows only this society, users only this society's members (never the password column);
 *   - child tables without society_id (flat_owners, poll_votes) are filtered through their parent;
 *   - shared reference tables (roles, permissions, role_permissions, plans) stay visible;
 *   - anything else (system logs, migrations, platform tables) is hidden.
 * Schema-qualified names such as public.members are rejected by the validator, so the views cannot be skipped.
 */

const SHARED_REFERENCE_TABLES = new Set(['roles', 'permissions', 'role_permissions', 'plans']);

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const ident = (name: string) => `"${name.replace(/"/g, '""')}"`;

class SandboxResult extends Error {
  constructor(readonly rows: any[]) {
    super('sandbox rollback');
  }
}

export async function runInSocietySandbox(db: DrizzleDB, societyId: string, reportSql: string): Promise<any[]> {
  if (!societyId || !UUID.test(societyId)) {
    throw new Error('A valid society is required to run a report.');
  }
  const sid = `'${societyId}'::uuid`;

  try {
    await db.transaction(async (tx) => {
      await tx.execute(sql.raw(`SET LOCAL statement_timeout = '10s'`));

      const tableRows: any = await tx.execute(sql.raw(`
        SELECT c.table_name AS name, bool_or(c.column_name = 'society_id') AS has_society
        FROM information_schema.columns c
        JOIN information_schema.tables t ON t.table_schema = c.table_schema AND t.table_name = c.table_name
        WHERE c.table_schema = 'public' AND t.table_type = 'BASE TABLE'
        GROUP BY c.table_name
      `));
      const tables: { name: string; has_society: boolean }[] = Array.isArray(tableRows) ? tableRows : tableRows.rows;

      for (const { name, has_society } of tables) {
        const src = `public.${ident(name)}`;
        let body: string;
        if (name === 'societies') {
          body = `SELECT * FROM ${src} WHERE id = ${sid}`;
        } else if (name === 'users') {
          body = `SELECT id, email, name, mobile, avatar_url, is_active, created_at, updated_at FROM ${src}
                  WHERE id IN (SELECT user_id FROM public.user_societies WHERE society_id = ${sid})`;
        } else if (has_society) {
          body = `SELECT * FROM ${src} WHERE society_id = ${sid}`;
        } else if (name === 'flat_owners') {
          body = `SELECT * FROM ${src} WHERE flat_id IN (SELECT id FROM public.flats WHERE society_id = ${sid})`;
        } else if (name === 'poll_votes') {
          body = `SELECT * FROM ${src} WHERE poll_id IN (SELECT id FROM public.polls WHERE society_id = ${sid})`;
        } else if (SHARED_REFERENCE_TABLES.has(name)) {
          continue;
        } else {
          body = `SELECT * FROM ${src} WHERE false`;
        }
        await tx.execute(sql.raw(`CREATE TEMP VIEW ${ident(name)} AS ${body}`));
      }

      // Nothing the report runs can write, even to the temporary views.
      await tx.execute(sql.raw(`SET LOCAL transaction_read_only = on`));

      const result: any = await tx.execute(sql.raw(reportSql));
      throw new SandboxResult(Array.isArray(result) ? result : result?.rows ?? []);
    });
  } catch (err) {
    if (err instanceof SandboxResult) return err.rows;
    throw err;
  }
  return [];
}
