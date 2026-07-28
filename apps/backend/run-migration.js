require('dotenv').config();
const postgres = require('postgres');
const sql = postgres(process.env.DATABASE_URL);

async function run() {
  try {
    await sql`ALTER TABLE receipts ADD COLUMN IF NOT EXISTS approved_by UUID REFERENCES users(id) ON DELETE SET NULL;`;
    await sql`ALTER TABLE receipts ADD COLUMN IF NOT EXISTS rejection_reason TEXT;`;
    await sql`ALTER TABLE receipts ADD COLUMN IF NOT EXISTS user_remark TEXT;`;
    // Update the check constraint or just rely on varchar for status.
    console.log("Migration successful");
  } catch (e) {
    console.error(e);
  } finally {
    process.exit(0);
  }
}
run();
