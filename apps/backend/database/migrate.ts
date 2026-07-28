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
  
  await migrate(db, { migrationsFolder: './database/migrations' });
  
  await migrationClient.end();
  console.log('Migrations completed successfully!');
  process.exit(0);
}

main().catch((err) => {
  console.error('Migration failed:', err);
  process.exit(1);
});
