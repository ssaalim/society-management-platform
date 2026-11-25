/**
 * One-time clean-up of ledgers the old name-based lookup created by mistake:
 *
 *  1. Duplicate system ledgers, e.g. "Maintenance Receivables" next to the seeded "Maintenance Dues Receivables":
 *     entries and charge heads move to the original, the duplicate is deleted, the original is tagged with its role.
 *  2. Bank ledgers not linked to any bank account (e.g. "Bank Account SBI"): each entry moves to the ledger of the bank
 *     account it belongs to (the receipt's deposit account, else the society's default bank account), and receipts and
 *     expenses are marked with that account. Only for societies that have a bank account set up.
 *  3. Ledger codes used twice in a society (or missing) are renumbered.
 *
 * Dry run by default: prints what it would change. Add --apply to make the changes (one transaction per society).
 *   npx ts-node database/merge-duplicate-ledgers.ts [--apply]
 */
import * as postgresModule from 'postgres';
import * as fs from 'fs';
import * as dotenv from 'dotenv';

if (fs.existsSync('.env.local')) dotenv.config({ path: '.env.local' });
else if (fs.existsSync('.env')) dotenv.config({ path: '.env' });

const postgres = (postgresModule as any).default || postgresModule;
const APPLY = process.argv.includes('--apply');

/** Same roles and names as LedgerResolver's SYSTEM_LEDGERS (src/core/accounting/ledger-resolver.service.ts). */
const ROLES: Record<string, { group: string; names: string[] }> = {
  CASH: { group: 'ASSETS', names: ['Cash in Hand Account', 'Cash in Hand'] },
  RECEIVABLES: { group: 'ASSETS', names: ['Maintenance Dues Receivables', 'Maintenance Receivables'] },
  MAINTENANCE_INCOME: { group: 'INCOME', names: ['Maintenance Charges Income', 'Maintenance Income'] },
  VENDOR_PAYABLES: { group: 'LIABILITIES', names: ['Vendor & Service Payables'] },
  GST_OUTPUT: { group: 'LIABILITIES', names: ['GST Output Payable'] },
  REFUNDS: { group: 'EXPENSES', names: ['Refunds to Members', 'Refund Expense Accounts'] },
  RESERVE_SURPLUS: { group: 'EQUITY', names: ['Accumulated General Reserve Surplus', 'Retained Earnings Reserves'] },
};
/** Names the old code used for "the bank"; only these unlinked bank ledgers are merged. */
const STRAY_BANK_NAMES = ['Bank Account SBI'];
const GROUP_PREFIX: Record<string, string> = { ASSETS: 'AST', LIABILITIES: 'LIA', EQUITY: 'EQU', INCOME: 'INC', EXPENSES: 'EXP' };

type Ledger = { id: string; name: string; group: string; code: string | null; system_key: string | null; created_at: Date };

async function main() {
  const sql = postgres(process.env.DATABASE_URL || 'postgresql://postgres:postgrespassword@localhost:5432/society_db', { prepare: false, onnotice: () => {} });
  console.log(APPLY ? 'Applying changes.\n' : 'Dry run: nothing will be changed. Add --apply to make these changes.\n');
  try {
    const societies = await sql`SELECT id, name FROM societies ORDER BY name`;
    for (const society of societies) {
      const log: string[] = [];
      await sql
        .begin(async (tx: any) => {
          await cleanSociety(tx, society.id, log);
          if (!APPLY) throw new DryRun();
        })
        .catch((err: any) => {
          if (!(err instanceof DryRun)) throw err;
        });
      if (log.length) console.log(`${society.name}\n${log.map((l) => `  - ${l}`).join('\n')}\n`);
    }
    console.log(APPLY ? 'Done.' : 'Dry run finished.');
  } finally {
    await sql.end();
  }
}

class DryRun extends Error {}

async function count(tx: any, ledgerId: string): Promise<number> {
  const [r] = await tx`SELECT count(*)::int AS n FROM transactions WHERE ledger_id = ${ledgerId}`;
  return r.n;
}

async function cleanSociety(tx: any, societyId: string, log: string[]) {
  // Make sure the role column exists (the API adds it on start-up; this script may run first).
  await tx`ALTER TABLE ledgers ADD COLUMN IF NOT EXISTS system_key varchar(40)`;

  // 1. Duplicate system ledgers.
  for (const [key, role] of Object.entries(ROLES)) {
    const found: Ledger[] = await tx`
      SELECT id, name, "group", code, system_key, created_at FROM ledgers
      WHERE society_id = ${societyId} AND "group" = ${role.group} AND (name IN ${tx(role.names)} OR system_key = ${key})
      ORDER BY created_at`;
    if (found.length === 0) continue;
    const keep =
      found.find((l) => l.system_key === key) ||
      role.names.map((n) => found.find((l) => l.name === n)).find(Boolean) ||
      found[0];
    for (const dup of found.filter((l) => l.id !== keep.id)) {
      const n = await count(tx, dup.id);
      await tx`UPDATE transactions SET ledger_id = ${keep.id} WHERE ledger_id = ${dup.id}`;
      await tx`UPDATE maintenance_heads SET ledger_id = ${keep.id} WHERE ledger_id = ${dup.id}`;
      await tx`UPDATE bank_accounts SET ledger_id = ${keep.id} WHERE ledger_id = ${dup.id}`;
      await tx`DELETE FROM ledgers WHERE id = ${dup.id}`;
      log.push(`"${dup.name}" merged into "${keep.name}" (${n} entries moved)`);
    }
    if (keep.system_key !== key) await tx`UPDATE ledgers SET system_key = ${key} WHERE id = ${keep.id}`;
  }

  // 2. Bank ledgers created by name that belong to no bank account.
  const accounts = await tx`
    SELECT b.id, b.ledger_id, b.bank_name, b.is_default, l.name AS ledger_name FROM bank_accounts b JOIN ledgers l ON l.id = b.ledger_id
    WHERE b.society_id = ${societyId} ORDER BY b.is_default DESC, b.created_at`;
  if (accounts.length > 0) {
    const fallback = accounts[0];
    const strays: Ledger[] = await tx`
      SELECT id, name, "group", code, system_key, created_at FROM ledgers l
      WHERE society_id = ${societyId} AND name IN ${tx(STRAY_BANK_NAMES)}
        AND NOT EXISTS (SELECT 1 FROM bank_accounts b WHERE b.ledger_id = l.id)`;
    for (const stray of strays) {
      const rows = await tx`
        SELECT t.id, t.voucher_id, r.id AS receipt_id, r.deposit_account_id
        FROM transactions t
        JOIN vouchers v ON v.id = t.voucher_id
        LEFT JOIN receipts r ON r.society_id = v.society_id AND 'VOU-' || r.receipt_number = v.voucher_number
        WHERE t.ledger_id = ${stray.id}`;
      const moved = new Map<string, number>();
      for (const row of rows) {
        const account = accounts.find((a: any) => a.id === row.deposit_account_id) || fallback;
        await tx`UPDATE transactions SET ledger_id = ${account.ledger_id} WHERE id = ${row.id}`;
        if (row.receipt_id && !row.deposit_account_id) {
          await tx`UPDATE receipts SET deposit_account_id = ${account.id} WHERE id = ${row.receipt_id}`;
        }
        await tx`UPDATE expenses SET bank_account_id = ${account.id} WHERE voucher_id = ${row.voucher_id} AND bank_account_id IS NULL`;
        moved.set(account.ledger_name, (moved.get(account.ledger_name) || 0) + 1);
      }
      await tx`DELETE FROM ledgers WHERE id = ${stray.id}`;
      const where = [...moved].map(([name, n]) => `${n} to "${name}"`).join(', ') || 'no entries';
      log.push(`"${stray.name}" (not linked to a bank account) removed; entries moved: ${where}`);
    }
  }

  // 3. Duplicate or missing ledger codes.
  const all: Ledger[] = await tx`
    SELECT id, name, "group", code, system_key, created_at FROM ledgers WHERE society_id = ${societyId} ORDER BY created_at, name`;
  const used = new Set<string>();
  const nextFree = (prefix: string) => {
    for (let i = 1; ; i++) {
      const code = `${prefix}-${String(i).padStart(2, '0')}`;
      if (!used.has(code) && !all.some((l) => l.code === code)) return code;
    }
  };
  for (const l of all) {
    if (l.code && !used.has(l.code)) {
      used.add(l.code);
      continue;
    }
    const prefix = l.code?.split('-')[0] || GROUP_PREFIX[l.group] || 'GEN';
    const code = nextFree(prefix);
    used.add(code);
    await tx`UPDATE ledgers SET code = ${code}, updated_at = now() WHERE id = ${l.id}`;
    log.push(`"${l.name}" code ${l.code || '(none)'} → ${code}`);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
