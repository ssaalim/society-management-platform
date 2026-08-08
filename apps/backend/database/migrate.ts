import { drizzle } from 'drizzle-orm/postgres-js';
import { migrate } from 'drizzle-orm/postgres-js/migrator';
import * as postgresModule from 'postgres';
import * as fs from 'fs';
import * as dotenv from 'dotenv';

// Support multiple environments
if (fs.existsSync('.env.local')) {
  dotenv.config({ path: '.env.local' });
} else if (fs.existsSync('.env')) {
  dotenv.config({ path: '.env' });
}

// Handle ESM/CJS interop – postgres may export as default or as module.default
const postgres = (postgresModule as any).default || postgresModule;

const dbUrl = process.env.DATABASE_URL || 'postgresql://postgres:postgrespassword@localhost:5432/society_db';

async function main() {
  console.log('Running Drizzle migrations...');
  const migrationClient = postgres(dbUrl, { max: 1 });
  const db = drizzle(migrationClient);

  console.log('Ensuring schema updates (can_login, password)...');
  await migrationClient`ALTER TABLE members ADD COLUMN IF NOT EXISTS can_login BOOLEAN DEFAULT true NOT NULL;`;
  await migrationClient`ALTER TABLE users ADD COLUMN IF NOT EXISTS password TEXT;`;
  
  await migrate(db, { migrationsFolder: './database/migrations' });
  
  await migrationClient.end();
  console.log('Migrations completed successfully!');
  process.exit(0);
}

main().catch((err) => {
  console.error('Migration failed:', err);
  process.exit(1);
});
