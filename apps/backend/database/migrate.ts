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
  console.log('Core Drizzle migrations applied.');

  try {
    console.log('Ensuring schema updates (can_login, password)...');
    await migrationClient`ALTER TABLE members ADD COLUMN IF NOT EXISTS can_login BOOLEAN DEFAULT true NOT NULL;`;
    await migrationClient`ALTER TABLE users ADD COLUMN IF NOT EXISTS password TEXT;`;

    console.log('Ensuring default roles, dummy society, superadmin, and plans...');

    // 1. Roles
    const defaultRoles = [
      { id: '10000000-0000-0000-0000-000000000001', name: 'SUPER_ADMIN', description: 'Platform Administrator' },
      { id: '10000000-0000-0000-0000-000000000002', name: 'SECRETARY', description: 'Society Secretary' },
      { id: '10000000-0000-0000-0000-000000000003', name: 'TREASURER', description: 'Society Treasurer' },
      { id: '10000000-0000-0000-0000-000000000004', name: 'COMMITTEE', description: 'Managing Committee Member' },
      { id: '10000000-0000-0000-0000-000000000005', name: 'OWNER', description: 'Flat Owner' },
      { id: '10000000-0000-0000-0000-000000000006', name: 'TENANT', description: 'Flat Resident / Tenant' },
      { id: '10000000-0000-0000-0000-000000000007', name: 'PRESIDENT', description: 'Society President' },
      { id: '10000000-0000-0000-0000-000000000008', name: 'ACCOUNTANT', description: 'Society Accountant' },
    ];
    for (const r of defaultRoles) {
      await migrationClient`
        INSERT INTO roles (id, name, description) 
        VALUES (${r.id}, ${r.name}, ${r.description}) 
        ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name, description = EXCLUDED.description;
      `;
    }

    // 2. Default Society (Sunview Heights)
    const defaultSocietyId = '30000000-0000-0000-0000-000000000001';
    await migrationClient`
      INSERT INTO societies (id, name, slug, address, registration_number, gstin, pan)
      VALUES (
        ${defaultSocietyId},
        'Sunview Heights CHS Ltd.',
        'sunview-heights',
        'Plot No. 42, Sector 21, Kharghar, Navi Mumbai - 410210',
        'MH/HSG/2018/00042',
        '27AABCS1234H1Z5',
        'AABCS1234H'
      )
      ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name;
    `;

    // 3. Default Super Admin User
    const superAdminUserId = '20000000-0000-0000-0000-000000000001';
    await migrationClient`
      INSERT INTO users (id, email, name, mobile, is_active)
      VALUES (
        ${superAdminUserId},
        'superadmin@society.dev',
        'Rajesh Kumar (Super Admin)',
        '+919000000001',
        true
      )
      ON CONFLICT (id) DO UPDATE SET is_active = true;
    `;

    // 4. Map Super Admin to Society
    await migrationClient`
      INSERT INTO user_societies (id, user_id, society_id, role_id)
      VALUES (
        '40000000-0000-0000-0000-000000000001',
        ${superAdminUserId},
        ${defaultSocietyId},
        '10000000-0000-0000-0000-000000000001'
      )
      ON CONFLICT (id) DO NOTHING;
    `;

    // 5. Default Subscription Plan
    const defaultPlanId = '60000000-0000-0000-0000-000000000001';
    await migrationClient`
      INSERT INTO plans (id, name, price, max_flats, max_storage_gb)
      VALUES (${defaultPlanId}, 'Enterprise Pro Plan', '4999.00', 500, 100)
      ON CONFLICT (id) DO NOTHING;
    `;

    // 6. Active Subscription for Society
    await migrationClient`
      INSERT INTO subscriptions (id, society_id, plan_id, status, start_date, end_date)
      VALUES (
        '70000000-0000-0000-0000-000000000001',
        ${defaultSocietyId},
        ${defaultPlanId},
        'ACTIVE',
        CURRENT_DATE,
        (CURRENT_DATE + INTERVAL '365 days')::date
      )
      ON CONFLICT (id) DO NOTHING;
    `;

    console.log('Default roles, dummy society, superadmin, and plans ensured successfully.');
  } catch (alterErr) {
    console.warn('Notice during schema ensure:', alterErr);
  }
  
  await migrationClient.end();
  console.log('Migrations completed successfully!');
  process.exit(0);
}

main().catch((err) => {
  console.error('Migration failed:', err);
  process.exit(1);
});
