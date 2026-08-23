import { Module, Global } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { drizzle } from 'drizzle-orm/postgres-js';
import * as postgresModule from 'postgres';
import * as schema from '../../../database/schema';

// Handle ESM/CJS interop – postgres is ESM-only
const postgres = (postgresModule as any).default || postgresModule;

export const DRIZZLE_PROVIDER = 'DRIZZLE_PROVIDER';

@Global()
@Module({
  providers: [
    {
      provide: DRIZZLE_PROVIDER,
      inject: [ConfigService],
      useFactory: async (configService: ConfigService) => {
        const url = configService.get<string>('DATABASE_URL') || 'postgresql://postgres:postgrespassword@localhost:5432/society_db';
        const client = postgres(url, { prepare: false });

        const runSafe = async (queryFn: () => Promise<any>, description: string) => {
          try {
            await queryFn();
          } catch (e: any) {
            // Ignore minor DDL warnings for existing relations
          }
        };

        // Resilient column & table auto-provisioning
        await runSafe(() => client`ALTER TABLE settings ADD COLUMN IF NOT EXISTS flat_types text DEFAULT '["1BHK","2BHK","3BHK","4BHK","Penthouse","Shop"]' NOT NULL;`, 'settings flat_types');
        await runSafe(() => client`ALTER TABLE settings ADD COLUMN IF NOT EXISTS per_flat_type_rates text DEFAULT '{"1BHK":1500,"2BHK":2500,"3BHK":3500,"Shop":4000}' NOT NULL;`, 'settings per_flat_type_rates');
        await runSafe(() => client`ALTER TABLE settings ADD COLUMN IF NOT EXISTS calculation_type varchar(50) DEFAULT 'PER_SQ_FT' NOT NULL;`, 'settings calculation_type');
        await runSafe(() => client`ALTER TABLE settings ADD COLUMN IF NOT EXISTS per_sqft_rate numeric(10, 2) DEFAULT '3.50' NOT NULL;`, 'settings per_sqft_rate');
        await runSafe(() => client`ALTER TABLE settings ADD COLUMN IF NOT EXISTS sqft_area_type varchar(50) DEFAULT 'SUPER_BUILTUP' NOT NULL;`, 'settings sqft_area_type');
        await runSafe(() => client`ALTER TABLE settings ADD COLUMN IF NOT EXISTS penalty_type varchar(50) DEFAULT 'PERCENTAGE' NOT NULL;`, 'settings penalty_type');
        await runSafe(() => client`ALTER TABLE settings ADD COLUMN IF NOT EXISTS penalty_interest_rate numeric(5, 2) DEFAULT '12.00' NOT NULL;`, 'settings penalty_interest_rate');
        await runSafe(() => client`ALTER TABLE settings ADD COLUMN IF NOT EXISTS penalty_flat_amount numeric(10, 2) DEFAULT '200.00' NOT NULL;`, 'settings penalty_flat_amount');
        await runSafe(() => client`ALTER TABLE settings ADD COLUMN IF NOT EXISTS penalty_grace_period_days integer DEFAULT 0 NOT NULL;`, 'settings penalty_grace_period_days');
        await runSafe(() => client`ALTER TABLE receipts ADD COLUMN IF NOT EXISTS late_fee_applied numeric(12, 2) DEFAULT '0.00' NOT NULL;`, 'receipts late_fee_applied');
        await runSafe(() => client`ALTER TABLE receipts ADD COLUMN IF NOT EXISTS late_fee_waived numeric(12, 2) DEFAULT '0.00' NOT NULL;`, 'receipts late_fee_waived');
        await runSafe(() => client`ALTER TABLE receipts ADD COLUMN IF NOT EXISTS discount_amount numeric(12, 2) DEFAULT '0.00' NOT NULL;`, 'receipts discount_amount');
        await runSafe(() => client`ALTER TABLE receipts ADD COLUMN IF NOT EXISTS discount_reason text;`, 'receipts discount_reason');
        await runSafe(() => client`ALTER TABLE users ADD COLUMN IF NOT EXISTS default_society_id uuid;`, 'users default_society_id');
        await runSafe(() => client`ALTER TABLE users ADD COLUMN IF NOT EXISTS password text;`, 'users password');
        await runSafe(() => client`ALTER TABLE members ADD COLUMN IF NOT EXISTS committee_designation varchar(100);`, 'members committee_designation');
        await runSafe(() => client`ALTER TABLE complaints ADD COLUMN IF NOT EXISTS assigned_staff_name varchar(150);`, 'complaints assigned_staff_name');
        await runSafe(() => client`ALTER TABLE complaints ADD COLUMN IF NOT EXISTS resolution_comment text;`, 'complaints resolution_comment');
        await runSafe(() => client`ALTER TABLE complaints ADD COLUMN IF NOT EXISTS resolved_at timestamptz;`, 'complaints resolved_at');
        await runSafe(() => client`ALTER TABLE complaints ADD COLUMN IF NOT EXISTS rating integer;`, 'complaints rating');

        // Ensure resident portal feature tables exist
        await runSafe(() => client`
          CREATE TABLE IF NOT EXISTS vehicles (
            id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
            society_id uuid NOT NULL REFERENCES societies(id) ON DELETE CASCADE,
            flat_id uuid NOT NULL REFERENCES flats(id) ON DELETE CASCADE,
            parking_slot_id uuid,
            number varchar(50) NOT NULL,
            type varchar(50) DEFAULT 'FOUR_WHEELER' NOT NULL,
            make varchar(100),
            model varchar(100),
            created_at timestamptz DEFAULT now() NOT NULL,
            updated_at timestamptz DEFAULT now() NOT NULL
          );
        `, 'vehicles table');

        await runSafe(() => client`ALTER TABLE vehicles ALTER COLUMN type TYPE varchar(50);`, 'vehicles type');

        await runSafe(() => client`
          CREATE TABLE IF NOT EXISTS documents (
            id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
            society_id uuid NOT NULL REFERENCES societies(id) ON DELETE CASCADE,
            name varchar(255) NOT NULL,
            file_url text NOT NULL,
            file_size integer,
            category varchar(100) NOT NULL,
            is_private boolean DEFAULT false NOT NULL,
            created_at timestamptz DEFAULT now() NOT NULL,
            updated_at timestamptz DEFAULT now() NOT NULL,
            deleted_at timestamptz
          );
        `, 'documents table');

        await runSafe(() => client`
          CREATE TABLE IF NOT EXISTS polls (
            id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
            society_id uuid NOT NULL REFERENCES societies(id) ON DELETE CASCADE,
            question varchar(255) NOT NULL,
            description text,
            end_date date NOT NULL,
            status varchar(50) DEFAULT 'ACTIVE' NOT NULL,
            created_at timestamptz DEFAULT now() NOT NULL,
            updated_at timestamptz DEFAULT now() NOT NULL
          );
        `, 'polls table');

        await runSafe(() => client`
          CREATE TABLE IF NOT EXISTS poll_votes (
            id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
            poll_id uuid NOT NULL REFERENCES polls(id) ON DELETE CASCADE,
            member_id uuid NOT NULL,
            choice varchar(50) NOT NULL,
            created_at timestamptz DEFAULT now() NOT NULL
          );
        `, 'poll_votes table');

        // Ensure standard society roles exist in roles table
        const committeeRoles = [
          ['SUPER_ADMIN', 'Platform super administrator'],
          ['PRESIDENT', 'Society President / Chairman'],
          ['VICE_PRESIDENT', 'Society Vice President'],
          ['SECRETARY', 'Society Secretary'],
          ['JOINT_SECRETARY', 'Society Joint Secretary'],
          ['TREASURER', 'Society Treasurer'],
          ['ACCOUNTANT', 'Society Accountant / Accounts Manager'],
          ['AUDITOR', 'Society Internal Auditor'],
          ['COMMITTEE_MEMBER', 'Executive Committee Member'],
          ['ESTATE_MANAGER', 'Estate / Facility Manager'],
          ['MAINTENANCE_INCHARGE', 'Maintenance Incharge'],
          ['SECURITY_SUPERVISOR', 'Security Supervisor / Head'],
          ['CULTURAL_SECRETARY', 'Cultural & Events Secretary'],
          ['LEGAL_ADVISOR', 'Legal & Compliance Advisor'],
          ['OWNER', 'Unit Owner'],
          ['TENANT', 'Unit Tenant']
        ];
        for (const [rName, rDesc] of committeeRoles) {
          await runSafe(() => client`INSERT INTO roles (id, name, description) VALUES (gen_random_uuid(), ${rName}, ${rDesc}) ON CONFLICT (name) DO NOTHING;`, `role ${rName}`);
        }

        // Custom SQL Report Builder tables
        await runSafe(() => client`
          CREATE TABLE IF NOT EXISTS custom_reports (
            id uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
            society_id uuid NOT NULL REFERENCES societies(id) ON DELETE CASCADE,
            name varchar(255) NOT NULL,
            description text,
            sql_query text NOT NULL,
            parameters jsonb DEFAULT '[]'::jsonb NOT NULL,
            is_active boolean DEFAULT true NOT NULL,
            created_by uuid REFERENCES users(id) ON DELETE SET NULL,
            updated_by uuid REFERENCES users(id) ON DELETE SET NULL,
            created_at timestamptz DEFAULT now() NOT NULL,
            updated_at timestamptz DEFAULT now() NOT NULL,
            deleted_at timestamptz
          );
        `, 'custom_reports table');

        await runSafe(() => client`CREATE INDEX IF NOT EXISTS idx_custom_reports_society ON custom_reports (society_id);`, 'custom_reports index');

        await runSafe(() => client`
          CREATE TABLE IF NOT EXISTS custom_report_favorites (
            id uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
            report_id uuid NOT NULL REFERENCES custom_reports(id) ON DELETE CASCADE,
            user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
            society_id uuid NOT NULL REFERENCES societies(id) ON DELETE CASCADE,
            created_at timestamptz DEFAULT now() NOT NULL
          );
        `, 'custom_report_favorites table');

        await runSafe(() => client`CREATE UNIQUE INDEX IF NOT EXISTS idx_custom_report_fav_unique ON custom_report_favorites (report_id, user_id);`, 'custom_report_favorites unique index');
        await runSafe(() => client`CREATE INDEX IF NOT EXISTS idx_custom_report_fav_user ON custom_report_favorites (user_id, society_id);`, 'custom_report_favorites user index');

        return drizzle(client, { schema });
      },
    },
  ],
  exports: [DRIZZLE_PROVIDER],
})
export class DatabaseModule {}
export type DrizzleDB = ReturnType<typeof drizzle<typeof schema>>;
