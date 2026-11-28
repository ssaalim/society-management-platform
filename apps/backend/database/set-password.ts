/**
 * Gives an account a password directly in the database, for people who cannot sign in (accounts created while
 * sign-in was on Supabase have no password stored here).
 *
 *   npm run db:set-password -- someone@example.com            # makes up a strong password and prints it once
 *   npm run db:set-password -- someone@example.com 'Their-Pass' # uses the one you give (at least 10 characters)
 *   npm run db:set-password -- --list-missing                  # who has no password yet
 *
 * Run it from apps/backend with DATABASE_URL pointing at the database you mean (for the live site: the production
 * one, e.g. in the Render shell). Only a bcrypt hash is stored. After the office can sign in, give residents invite
 * codes from the Members page instead; they then choose their own password.
 */
import * as fs from 'fs';
import * as dotenv from 'dotenv';
import * as bcrypt from 'bcryptjs';
import { randomInt } from 'crypto';
import * as postgresModule from 'postgres';

if (fs.existsSync('.env.local')) dotenv.config({ path: '.env.local' });
else if (fs.existsSync('.env')) dotenv.config({ path: '.env' });
const postgres = (postgresModule as any).default || postgresModule;

const ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789';
const makePassword = () => Array.from({ length: 14 }, () => ALPHABET[randomInt(ALPHABET.length)]).join('');

async function main() {
  const [arg, given] = process.argv.slice(2);
  if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL is not set.');
  const sql = postgres(process.env.DATABASE_URL, { max: 1 });
  try {
    const host = new URL(process.env.DATABASE_URL).host;
    console.log(`Database: ${host}`);
    if (!arg) {
      console.log('Usage: npm run db:set-password -- <email> [password]   or   -- --list-missing');
      return;
    }
    if (arg === '--list-missing') {
      const rows = await sql`
        select u.email, u.is_platform_admin as admin,
          coalesce(string_agg(s.name || ': ' || r.name, '; '), 'no society') as memberships
        from users u left join user_societies us on us.user_id = u.id left join societies s on s.id = us.society_id left join roles r on r.id = us.role_id
        where u.password is null or u.password = ''
        group by u.id order by u.is_platform_admin desc, u.email`;
      if (!rows.length) console.log('Every account has a password.');
      for (const r of rows) console.log(`${r.email}${r.admin ? '  [platform admin]' : ''}  —  ${r.memberships}`);
      return;
    }
    const email = arg.trim().toLowerCase();
    if (given && given.length < 10) throw new Error('Use a password of at least 10 characters (or leave it out to generate one).');
    const password = given || makePassword();
    const rows = await sql`update users set password = ${bcrypt.hashSync(password, 10)}, is_active = true, updated_at = now() where lower(email) = ${email} returning email`;
    if (!rows.length) throw new Error(`No account with the email ${email}.`);
    console.log(`Password set for ${rows[0].email}.`);
    if (!given) console.log(`New password (shown once, pass it on privately): ${password}`);
  } finally {
    await sql.end();
  }
}

main().catch((err) => {
  console.error(err.message || err);
  process.exit(1);
});
