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

        // One membership per user per society. Auto-provisioning (superadmin guard, dev login) inserted links with
        // random ids and ON CONFLICT DO NOTHING, which never fired without this index, so duplicates piled up.
        // Keep the oldest link for each pair, then enforce uniqueness.
        await runSafe(() => client`
          DELETE FROM user_societies a
          USING user_societies b
          WHERE a.user_id = b.user_id
            AND a.society_id = b.society_id
            AND (a.created_at > b.created_at OR (a.created_at = b.created_at AND a.id > b.id));
        `, 'user_societies duplicates');
        await runSafe(() => client`CREATE UNIQUE INDEX IF NOT EXISTS idx_user_societies_user_society_unique ON user_societies (user_id, society_id);`, 'user_societies unique index');

        // Bill generation: per-bill penalty start, generation batch, and an index for the overlap check.
        await runSafe(() => client`ALTER TABLE maintenance_bills ADD COLUMN IF NOT EXISTS penalty_from_date date;`, 'maintenance_bills penalty_from_date');
        await runSafe(() => client`ALTER TABLE maintenance_bills ADD COLUMN IF NOT EXISTS generation_batch_id uuid;`, 'maintenance_bills generation_batch_id');
        await runSafe(() => client`CREATE INDEX IF NOT EXISTS idx_m_bills_flat_period ON maintenance_bills (flat_id, billing_period_start, billing_period_end);`, 'maintenance_bills flat period index');

        // Billing categories (residential / commercial rates, floor rates, GST, own late fees)
        await runSafe(() => client`
          CREATE TABLE IF NOT EXISTS billing_categories (
            id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
            society_id uuid NOT NULL REFERENCES societies(id) ON DELETE CASCADE,
            name varchar(100) NOT NULL,
            usage varchar(20) NOT NULL DEFAULT 'RESIDENTIAL',
            calculation_type varchar(30) NOT NULL DEFAULT 'SOCIETY_FORMULA',
            area_type varchar(30) NOT NULL DEFAULT 'SUPER_BUILTUP',
            rate numeric(12,2) NOT NULL DEFAULT 0,
            floor_rates jsonb NOT NULL DEFAULT '[]',
            extra_charges jsonb NOT NULL DEFAULT '{}',
            include_parking boolean NOT NULL DEFAULT true,
            flat_types jsonb NOT NULL DEFAULT '[]',
            invoice_prefix varchar(20) NOT NULL DEFAULT 'INV',
            gst_enabled boolean NOT NULL DEFAULT false,
            gst_rate numeric(5,2) NOT NULL DEFAULT 18,
            gst_threshold_monthly numeric(12,2) NOT NULL DEFAULT 7500,
            penalty_type varchar(50),
            penalty_interest_rate numeric(5,2),
            penalty_flat_amount numeric(10,2),
            penalty_grace_period_days integer,
            is_default boolean NOT NULL DEFAULT false,
            sort_order integer NOT NULL DEFAULT 0,
            created_at timestamptz NOT NULL DEFAULT now(),
            updated_at timestamptz NOT NULL DEFAULT now()
          );
        `, 'billing_categories table');
        await runSafe(() => client`CREATE INDEX IF NOT EXISTS idx_billing_categories_society ON billing_categories (society_id);`, 'billing_categories index');
        await runSafe(() => client`ALTER TABLE flats ADD COLUMN IF NOT EXISTS billing_category_id uuid;`, 'flats billing_category_id');
        await runSafe(() => client`ALTER TABLE maintenance_bills ADD COLUMN IF NOT EXISTS billing_category_id uuid;`, 'maintenance_bills billing_category_id');
        await runSafe(() => client`ALTER TABLE maintenance_bills ADD COLUMN IF NOT EXISTS subtotal_amount numeric(12,2);`, 'maintenance_bills subtotal_amount');
        await runSafe(() => client`ALTER TABLE maintenance_bills ADD COLUMN IF NOT EXISTS gst_rate numeric(5,2);`, 'maintenance_bills gst_rate');
        await runSafe(() => client`ALTER TABLE maintenance_bills ADD COLUMN IF NOT EXISTS gst_amount numeric(12,2);`, 'maintenance_bills gst_amount');

        // Platform admins are a property of the user, not a society membership. Convert legacy SUPER_ADMIN society
        // links into the flag and remove them, so platform staff never hold a seat inside a society.
        await runSafe(() => client`ALTER TABLE users ADD COLUMN IF NOT EXISTS is_platform_admin boolean DEFAULT false NOT NULL;`, 'users is_platform_admin');
        await runSafe(() => client`
          UPDATE users SET is_platform_admin = true
          WHERE id IN (
            SELECT us.user_id FROM user_societies us JOIN roles r ON r.id = us.role_id WHERE r.name = 'SUPER_ADMIN'
          );
        `, 'platform admins from SUPER_ADMIN links');
        await runSafe(() => client`
          DELETE FROM user_societies us USING roles r WHERE r.id = us.role_id AND r.name = 'SUPER_ADMIN';
        `, 'remove SUPER_ADMIN society links');
        // "Onboard society" used to add the platform admin who created a society as a second PRESIDENT. Remove
        // exactly those links (created with the society, alongside the real president); memberships a platform
        // admin was given separately are kept.
        await runSafe(() => client`
          DELETE FROM user_societies us
          USING users u, roles r, societies s
          WHERE u.id = us.user_id AND u.is_platform_admin
            AND r.id = us.role_id AND r.name = 'PRESIDENT'
            AND s.id = us.society_id
            AND us.created_at BETWEEN s.created_at AND s.created_at + interval '1 minute'
            AND EXISTS (
              SELECT 1 FROM user_societies o JOIN roles orl ON orl.id = o.role_id
              WHERE o.society_id = us.society_id AND o.user_id <> us.user_id AND orl.name = 'PRESIDENT'
            );
        `, 'remove auto-added platform admin presidents');

        // Storage Usage tracking for free tier quota enforcement
        await runSafe(() => client`
          CREATE TABLE IF NOT EXISTS storage_usage (
            month_key varchar(7) PRIMARY KEY NOT NULL,
            upload_count integer DEFAULT 0 NOT NULL,
            total_bytes numeric(20, 0) DEFAULT '0' NOT NULL,
            updated_at timestamptz DEFAULT now() NOT NULL
          );
        `, 'storage_usage table');

        // Recurring expenses: templates that draft an expense every period.
        await runSafe(() => client`
          CREATE TABLE IF NOT EXISTS recurring_expenses (
            id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
            society_id uuid NOT NULL REFERENCES societies(id) ON DELETE CASCADE,
            name varchar(150) NOT NULL,
            expense_head varchar(255) NOT NULL,
            vendor_name varchar(255),
            staff_id uuid REFERENCES staff(id) ON DELETE SET NULL,
            amount_type varchar(20) NOT NULL DEFAULT 'FIXED',
            amount numeric(12,2) NOT NULL DEFAULT 0,
            frequency varchar(20) NOT NULL DEFAULT 'MONTHLY',
            day_of_month integer NOT NULL DEFAULT 1,
            start_date date NOT NULL,
            end_date date,
            next_run_date date NOT NULL,
            last_run_date date,
            auto_post boolean NOT NULL DEFAULT false,
            post_as varchar(10) NOT NULL DEFAULT 'UNPAID',
            payment_mode varchar(20) NOT NULL DEFAULT 'BANK',
            is_active boolean NOT NULL DEFAULT true,
            notes text,
            created_by uuid,
            created_at timestamptz NOT NULL DEFAULT now(),
            updated_at timestamptz NOT NULL DEFAULT now()
          );
        `, 'recurring_expenses table');
        await runSafe(() => client`CREATE INDEX IF NOT EXISTS idx_recurring_expenses_society ON recurring_expenses (society_id);`, 'recurring_expenses society index');
        await runSafe(() => client`CREATE INDEX IF NOT EXISTS idx_recurring_expenses_due ON recurring_expenses (is_active, next_run_date);`, 'recurring_expenses due index');
        await runSafe(() => client`ALTER TABLE expenses ADD COLUMN IF NOT EXISTS recurring_expense_id uuid;`, 'expenses recurring_expense_id');
        await runSafe(() => client`ALTER TABLE expenses ADD COLUMN IF NOT EXISTS period_key varchar(7);`, 'expenses period_key');
        await runSafe(() => client`ALTER TABLE expenses ADD COLUMN IF NOT EXISTS description varchar(255);`, 'expenses description');
        await runSafe(() => client`ALTER TABLE expenses ADD COLUMN IF NOT EXISTS expense_head varchar(255);`, 'expenses expense_head');
        await runSafe(() => client`ALTER TABLE expenses ADD COLUMN IF NOT EXISTS payment_mode varchar(20);`, 'expenses payment_mode');
        await runSafe(() => client`CREATE UNIQUE INDEX IF NOT EXISTS uq_expenses_recurring_period ON expenses (recurring_expense_id, period_key);`, 'expenses recurring period unique');

        // System ledger roles (cash, receivables, income, ...), so automatic postings don't depend on ledger names.
        await runSafe(() => client`ALTER TABLE ledgers ADD COLUMN IF NOT EXISTS system_key varchar(40);`, 'ledgers system_key');
        await runSafe(() => client`ALTER TABLE expenses ADD COLUMN IF NOT EXISTS bank_account_id uuid REFERENCES bank_accounts(id) ON DELETE SET NULL;`, 'expenses bank_account_id');
        await runSafe(() => client`ALTER TABLE recurring_expenses ADD COLUMN IF NOT EXISTS bank_account_id uuid REFERENCES bank_accounts(id) ON DELETE SET NULL;`, 'recurring_expenses bank_account_id');

        // Facility & service charges.
        await runSafe(() => client`
          CREATE TABLE IF NOT EXISTS service_charges (
            id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
            society_id uuid NOT NULL REFERENCES societies(id) ON DELETE CASCADE,
            name varchar(150) NOT NULL,
            description text,
            kind varchar(20) NOT NULL DEFAULT 'SERVICE',
            pricing varchar(20) NOT NULL DEFAULT 'FIXED',
            rate numeric(12,2) NOT NULL DEFAULT 0,
            deposit_amount numeric(12,2) NOT NULL DEFAULT 0,
            gst_rate numeric(5,2) NOT NULL DEFAULT 0,
            requires_approval boolean NOT NULL DEFAULT true,
            resident_can_request boolean NOT NULL DEFAULT true,
            income_ledger_id uuid REFERENCES ledgers(id) ON DELETE SET NULL,
            is_active boolean NOT NULL DEFAULT true,
            created_at timestamptz NOT NULL DEFAULT now(),
            updated_at timestamptz NOT NULL DEFAULT now()
          );`, 'service_charges table');
        await runSafe(() => client`CREATE INDEX IF NOT EXISTS idx_service_charges_society ON service_charges (society_id);`, 'service_charges index');
        await runSafe(() => client`
          CREATE TABLE IF NOT EXISTS service_requests (
            id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
            society_id uuid NOT NULL REFERENCES societies(id) ON DELETE CASCADE,
            charge_id uuid NOT NULL REFERENCES service_charges(id) ON DELETE RESTRICT,
            flat_id uuid NOT NULL REFERENCES flats(id) ON DELETE CASCADE,
            requested_by uuid REFERENCES users(id) ON DELETE SET NULL,
            start_at timestamptz,
            end_at timestamptz,
            quantity numeric(8,2) NOT NULL DEFAULT 1,
            purpose text,
            status varchar(20) NOT NULL DEFAULT 'REQUESTED',
            charge_amount numeric(12,2) NOT NULL DEFAULT 0,
            gst_amount numeric(12,2) NOT NULL DEFAULT 0,
            deposit_amount numeric(12,2) NOT NULL DEFAULT 0,
            total_amount numeric(12,2) NOT NULL DEFAULT 0,
            invoice_number varchar(30),
            decided_by uuid REFERENCES users(id) ON DELETE SET NULL,
            decided_at timestamptz,
            decision_note text,
            payment_status varchar(20) NOT NULL DEFAULT 'UNPAID',
            receipt_number varchar(30),
            paid_at date,
            payment_mode varchar(20),
            bank_account_id uuid REFERENCES bank_accounts(id) ON DELETE SET NULL,
            payment_reference varchar(100),
            payment_voucher_id uuid REFERENCES vouchers(id) ON DELETE SET NULL,
            deposit_status varchar(20) NOT NULL DEFAULT 'NONE',
            deposit_refunded numeric(12,2),
            deposit_refunded_at date,
            deposit_note text,
            refund_voucher_id uuid REFERENCES vouchers(id) ON DELETE SET NULL,
            created_at timestamptz NOT NULL DEFAULT now(),
            updated_at timestamptz NOT NULL DEFAULT now()
          );`, 'service_requests table');
        await runSafe(() => client`CREATE INDEX IF NOT EXISTS idx_service_requests_society ON service_requests (society_id, status);`, 'service_requests index');
        await runSafe(() => client`CREATE INDEX IF NOT EXISTS idx_service_requests_charge ON service_requests (charge_id, start_at);`, 'service_requests charge index');
        await runSafe(() => client`CREATE UNIQUE INDEX IF NOT EXISTS uq_service_requests_invoice ON service_requests (society_id, invoice_number);`, 'service_requests invoice unique');

        // Managing committee terms and posts.
        await runSafe(() => client`
          CREATE TABLE IF NOT EXISTS committee_terms (
            id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
            society_id uuid NOT NULL REFERENCES societies(id) ON DELETE CASCADE,
            name varchar(100) NOT NULL,
            start_date date NOT NULL,
            end_date date,
            elected_on date,
            status varchar(20) NOT NULL DEFAULT 'DRAFT',
            notes text,
            handed_over_at timestamptz,
            handed_over_by uuid REFERENCES users(id) ON DELETE SET NULL,
            created_at timestamptz NOT NULL DEFAULT now(),
            updated_at timestamptz NOT NULL DEFAULT now()
          );`, 'committee_terms table');
        await runSafe(() => client`CREATE INDEX IF NOT EXISTS idx_committee_terms_society ON committee_terms (society_id);`, 'committee_terms index');
        await runSafe(() => client`CREATE UNIQUE INDEX IF NOT EXISTS uq_committee_terms_current ON committee_terms (society_id) WHERE status = 'CURRENT';`, 'committee_terms current unique');
        await runSafe(() => client`
          CREATE TABLE IF NOT EXISTS committee_positions (
            id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
            society_id uuid NOT NULL REFERENCES societies(id) ON DELETE CASCADE,
            term_id uuid NOT NULL REFERENCES committee_terms(id) ON DELETE CASCADE,
            member_id uuid NOT NULL REFERENCES members(id) ON DELETE CASCADE,
            designation varchar(50) NOT NULL,
            responsibilities text,
            bio text,
            show_contact boolean NOT NULL DEFAULT false,
            sort_order integer NOT NULL DEFAULT 0,
            start_date date,
            end_date date,
            status varchar(20) NOT NULL DEFAULT 'ACTIVE',
            end_reason text,
            created_at timestamptz NOT NULL DEFAULT now(),
            updated_at timestamptz NOT NULL DEFAULT now()
          );`, 'committee_positions table');
        await runSafe(() => client`CREATE INDEX IF NOT EXISTS idx_committee_positions_term ON committee_positions (term_id);`, 'committee_positions index');

        // Meetings / AGM: existing meetings count as already scheduled, existing minutes as final.
        await runSafe(() => client`ALTER TABLE meetings ADD COLUMN IF NOT EXISTS audience varchar(20) NOT NULL DEFAULT 'ALL_MEMBERS';`, 'meetings audience');
        await runSafe(() => client`ALTER TABLE meetings ADD COLUMN IF NOT EXISTS status varchar(20) NOT NULL DEFAULT 'SCHEDULED';`, 'meetings status');
        await runSafe(() => client`ALTER TABLE meetings ALTER COLUMN status SET DEFAULT 'DRAFT';`, 'meetings status default');
        await runSafe(() => client`ALTER TABLE meetings ADD COLUMN IF NOT EXISTS quorum_required integer;`, 'meetings quorum');
        await runSafe(() => client`ALTER TABLE meetings ADD COLUMN IF NOT EXISTS notice_sent_at timestamptz;`, 'meetings notice_sent_at');
        await runSafe(() => client`ALTER TABLE meetings ADD COLUMN IF NOT EXISTS cancel_reason text;`, 'meetings cancel_reason');
        await runSafe(() => client`ALTER TABLE meetings ADD COLUMN IF NOT EXISTS created_by uuid REFERENCES users(id) ON DELETE SET NULL;`, 'meetings created_by');
        await runSafe(() => client`UPDATE meetings SET audience = 'COMMITTEE' WHERE type = 'COMMITTEE' AND notice_sent_at IS NULL AND created_by IS NULL AND audience = 'ALL_MEMBERS';`, 'meetings audience for old committee meetings');
        await runSafe(() => client`UPDATE meetings SET status = 'HELD' WHERE status = 'SCHEDULED' AND created_by IS NULL AND notice_sent_at IS NULL AND scheduled_at < now();`, 'meetings: older past meetings were held');
        await runSafe(() => client`ALTER TABLE meeting_minutes ADD COLUMN IF NOT EXISTS status varchar(20) NOT NULL DEFAULT 'FINAL';`, 'minutes status');
        await runSafe(() => client`ALTER TABLE meeting_minutes ALTER COLUMN status SET DEFAULT 'DRAFT';`, 'minutes status default');
        await runSafe(() => client`ALTER TABLE meeting_minutes ADD COLUMN IF NOT EXISTS finalised_at timestamptz;`, 'minutes finalised_at');
        await runSafe(() => client`ALTER TABLE meeting_minutes ADD COLUMN IF NOT EXISTS finalised_by uuid REFERENCES users(id) ON DELETE SET NULL;`, 'minutes finalised_by');
        await runSafe(() => client`
          CREATE TABLE IF NOT EXISTS meeting_agenda_items (
            id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
            society_id uuid NOT NULL REFERENCES societies(id) ON DELETE CASCADE,
            meeting_id uuid NOT NULL REFERENCES meetings(id) ON DELETE CASCADE,
            position integer NOT NULL DEFAULT 0,
            title varchar(255) NOT NULL,
            description text,
            presenter varchar(150),
            created_at timestamptz NOT NULL DEFAULT now()
          );`, 'meeting_agenda_items table');
        await runSafe(() => client`CREATE INDEX IF NOT EXISTS idx_meeting_agenda_meeting ON meeting_agenda_items (meeting_id);`, 'agenda index');
        await runSafe(() => client`
          CREATE TABLE IF NOT EXISTS meeting_rsvps (
            id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
            society_id uuid NOT NULL REFERENCES societies(id) ON DELETE CASCADE,
            meeting_id uuid NOT NULL REFERENCES meetings(id) ON DELETE CASCADE,
            user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
            response varchar(20) NOT NULL,
            updated_at timestamptz NOT NULL DEFAULT now()
          );`, 'meeting_rsvps table');
        await runSafe(() => client`CREATE UNIQUE INDEX IF NOT EXISTS uq_meeting_rsvps ON meeting_rsvps (meeting_id, user_id);`, 'rsvps unique');
        await runSafe(() => client`
          CREATE TABLE IF NOT EXISTS meeting_attendance (
            id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
            society_id uuid NOT NULL REFERENCES societies(id) ON DELETE CASCADE,
            meeting_id uuid NOT NULL REFERENCES meetings(id) ON DELETE CASCADE,
            user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
            marked_by uuid REFERENCES users(id) ON DELETE SET NULL,
            marked_at timestamptz NOT NULL DEFAULT now()
          );`, 'meeting_attendance table');
        await runSafe(() => client`CREATE UNIQUE INDEX IF NOT EXISTS uq_meeting_attendance ON meeting_attendance (meeting_id, user_id);`, 'attendance unique');
        await runSafe(() => client`
          CREATE TABLE IF NOT EXISTS meeting_resolutions (
            id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
            society_id uuid NOT NULL REFERENCES societies(id) ON DELETE CASCADE,
            meeting_id uuid NOT NULL REFERENCES meetings(id) ON DELETE CASCADE,
            agenda_item_id uuid REFERENCES meeting_agenda_items(id) ON DELETE SET NULL,
            number integer NOT NULL,
            title varchar(255) NOT NULL,
            body text,
            proposed_by varchar(150),
            seconded_by varchar(150),
            voters varchar(20) NOT NULL DEFAULT 'OWNERS',
            one_per_flat boolean NOT NULL DEFAULT true,
            threshold varchar(20) NOT NULL DEFAULT 'SIMPLE',
            status varchar(20) NOT NULL DEFAULT 'DRAFT',
            voting_deadline timestamptz,
            result varchar(20),
            for_count integer,
            against_count integer,
            abstain_count integer,
            closed_at timestamptz,
            closed_by uuid REFERENCES users(id) ON DELETE SET NULL,
            created_at timestamptz NOT NULL DEFAULT now(),
            updated_at timestamptz NOT NULL DEFAULT now()
          );`, 'meeting_resolutions table');
        await runSafe(() => client`CREATE INDEX IF NOT EXISTS idx_meeting_resolutions_meeting ON meeting_resolutions (meeting_id);`, 'resolutions index');
        await runSafe(() => client`
          CREATE TABLE IF NOT EXISTS resolution_votes (
            id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
            society_id uuid NOT NULL REFERENCES societies(id) ON DELETE CASCADE,
            resolution_id uuid NOT NULL REFERENCES meeting_resolutions(id) ON DELETE CASCADE,
            user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
            flat_id uuid REFERENCES flats(id) ON DELETE CASCADE,
            choice varchar(10) NOT NULL,
            recorded_by uuid REFERENCES users(id) ON DELETE SET NULL,
            recorded_note text,
            created_at timestamptz NOT NULL DEFAULT now(),
            updated_at timestamptz NOT NULL DEFAULT now()
          );`, 'resolution_votes table');
        await runSafe(() => client`CREATE UNIQUE INDEX IF NOT EXISTS uq_resolution_votes_flat ON resolution_votes (resolution_id, flat_id) WHERE flat_id IS NOT NULL;`, 'votes flat unique');
        await runSafe(() => client`CREATE UNIQUE INDEX IF NOT EXISTS uq_resolution_votes_user ON resolution_votes (resolution_id, user_id) WHERE flat_id IS NULL;`, 'votes user unique');
        await runSafe(() => client`
          CREATE TABLE IF NOT EXISTS meeting_action_items (
            id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
            society_id uuid NOT NULL REFERENCES societies(id) ON DELETE CASCADE,
            meeting_id uuid NOT NULL REFERENCES meetings(id) ON DELETE CASCADE,
            resolution_id uuid REFERENCES meeting_resolutions(id) ON DELETE SET NULL,
            title varchar(255) NOT NULL,
            owner_user_id uuid REFERENCES users(id) ON DELETE SET NULL,
            due_date date,
            status varchar(20) NOT NULL DEFAULT 'OPEN',
            notes text,
            created_at timestamptz NOT NULL DEFAULT now(),
            updated_at timestamptz NOT NULL DEFAULT now()
          );`, 'meeting_action_items table');
        await runSafe(() => client`CREATE INDEX IF NOT EXISTS idx_meeting_action_items_meeting ON meeting_action_items (meeting_id);`, 'action items index');

        // Visitors: gate log, guest passes, daily help.
        await runSafe(() => client`ALTER TABLE visitors ADD COLUMN IF NOT EXISTS headcount integer NOT NULL DEFAULT 1;`, 'visitors headcount');
        await runSafe(() => client`ALTER TABLE visitors ADD COLUMN IF NOT EXISTS entered_at timestamptz;`, 'visitors entered_at');
        await runSafe(() => client`ALTER TABLE visitors ADD COLUMN IF NOT EXISTS approval_method varchar(20);`, 'visitors approval_method');
        await runSafe(() => client`ALTER TABLE visitors ADD COLUMN IF NOT EXISTS decided_by uuid REFERENCES users(id) ON DELETE SET NULL;`, 'visitors decided_by');
        await runSafe(() => client`ALTER TABLE visitors ADD COLUMN IF NOT EXISTS decided_at timestamptz;`, 'visitors decided_at');
        await runSafe(() => client`ALTER TABLE visitors ADD COLUMN IF NOT EXISTS decision_note text;`, 'visitors decision_note');
        await runSafe(() => client`ALTER TABLE visitors ADD COLUMN IF NOT EXISTS logged_by uuid REFERENCES users(id) ON DELETE SET NULL;`, 'visitors logged_by');
        await runSafe(() => client`ALTER TABLE visitors ADD COLUMN IF NOT EXISTS pass_id uuid;`, 'visitors pass_id');
        await runSafe(() => client`ALTER TABLE visitors ADD COLUMN IF NOT EXISTS daily_help_id uuid;`, 'visitors daily_help_id');
        await runSafe(() => client`CREATE INDEX IF NOT EXISTS idx_visitors_flat ON visitors (flat_id, entry_time);`, 'visitors flat index');
        await runSafe(() => client`CREATE INDEX IF NOT EXISTS idx_visitors_status ON visitors (society_id, status);`, 'visitors status index');
        await runSafe(() => client`
          CREATE TABLE IF NOT EXISTS visitor_passes (
            id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
            society_id uuid NOT NULL REFERENCES societies(id) ON DELETE CASCADE,
            flat_id uuid NOT NULL REFERENCES flats(id) ON DELETE CASCADE,
            created_by uuid REFERENCES users(id) ON DELETE SET NULL,
            guest_name varchar(150) NOT NULL,
            guest_mobile varchar(15),
            type varchar(20) NOT NULL DEFAULT 'GUEST',
            vehicle_number varchar(50),
            code varchar(10) NOT NULL,
            valid_from timestamptz NOT NULL,
            valid_until timestamptz NOT NULL,
            max_uses integer NOT NULL DEFAULT 1,
            uses_count integer NOT NULL DEFAULT 0,
            revoked_at timestamptz,
            notes text,
            created_at timestamptz NOT NULL DEFAULT now()
          );`, 'visitor_passes table');
        await runSafe(() => client`CREATE INDEX IF NOT EXISTS idx_visitor_passes_code ON visitor_passes (society_id, code);`, 'passes code index');
        await runSafe(() => client`CREATE INDEX IF NOT EXISTS idx_visitor_passes_flat ON visitor_passes (flat_id);`, 'passes flat index');
        await runSafe(() => client`
          CREATE TABLE IF NOT EXISTS daily_help (
            id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
            society_id uuid NOT NULL REFERENCES societies(id) ON DELETE CASCADE,
            name varchar(150) NOT NULL,
            mobile varchar(15) NOT NULL,
            category varchar(30) NOT NULL,
            code varchar(10) NOT NULL,
            is_active boolean NOT NULL DEFAULT true,
            created_by uuid REFERENCES users(id) ON DELETE SET NULL,
            created_at timestamptz NOT NULL DEFAULT now(),
            updated_at timestamptz NOT NULL DEFAULT now()
          );`, 'daily_help table');
        await runSafe(() => client`CREATE INDEX IF NOT EXISTS idx_daily_help_society ON daily_help (society_id);`, 'daily help index');
        await runSafe(() => client`CREATE UNIQUE INDEX IF NOT EXISTS uq_daily_help_mobile ON daily_help (society_id, mobile);`, 'daily help mobile unique');
        await runSafe(() => client`
          CREATE TABLE IF NOT EXISTS daily_help_flats (
            id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
            society_id uuid NOT NULL REFERENCES societies(id) ON DELETE CASCADE,
            daily_help_id uuid NOT NULL REFERENCES daily_help(id) ON DELETE CASCADE,
            flat_id uuid NOT NULL REFERENCES flats(id) ON DELETE CASCADE,
            added_by uuid REFERENCES users(id) ON DELETE SET NULL,
            created_at timestamptz NOT NULL DEFAULT now()
          );`, 'daily_help_flats table');
        await runSafe(() => client`CREATE UNIQUE INDEX IF NOT EXISTS uq_daily_help_flats ON daily_help_flats (daily_help_id, flat_id);`, 'daily help flats unique');

        // Fund collection.
        await runSafe(() => client`
          CREATE TABLE IF NOT EXISTS fund_campaigns (
            id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
            society_id uuid NOT NULL REFERENCES societies(id) ON DELETE CASCADE,
            name varchar(150) NOT NULL,
            description text,
            target_amount numeric(14,2) NOT NULL,
            method varchar(20) NOT NULL,
            per_flat_amount numeric(12,2),
            rate_per_sqft numeric(10,4),
            type_amounts jsonb,
            due_date date,
            status varchar(20) NOT NULL DEFAULT 'DRAFT',
            ledger_id uuid REFERENCES ledgers(id) ON DELETE RESTRICT,
            issued_at timestamptz,
            closed_at timestamptz,
            created_by uuid REFERENCES users(id) ON DELETE SET NULL,
            created_at timestamptz NOT NULL DEFAULT now(),
            updated_at timestamptz NOT NULL DEFAULT now()
          );`, 'fund_campaigns table');
        await runSafe(() => client`CREATE INDEX IF NOT EXISTS idx_fund_campaigns_society ON fund_campaigns (society_id);`, 'fund campaigns index');
        await runSafe(() => client`
          CREATE TABLE IF NOT EXISTS fund_shares (
            id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
            society_id uuid NOT NULL REFERENCES societies(id) ON DELETE CASCADE,
            campaign_id uuid NOT NULL REFERENCES fund_campaigns(id) ON DELETE CASCADE,
            flat_id uuid NOT NULL REFERENCES flats(id) ON DELETE RESTRICT,
            invoice_number varchar(30) NOT NULL,
            amount numeric(12,2) NOT NULL,
            paid_amount numeric(12,2) NOT NULL DEFAULT 0,
            status varchar(20) NOT NULL DEFAULT 'UNPAID',
            waived_reason text,
            created_at timestamptz NOT NULL DEFAULT now(),
            updated_at timestamptz NOT NULL DEFAULT now()
          );`, 'fund_shares table');
        await runSafe(() => client`CREATE UNIQUE INDEX IF NOT EXISTS uq_fund_shares_flat ON fund_shares (campaign_id, flat_id);`, 'fund shares flat unique');
        await runSafe(() => client`CREATE UNIQUE INDEX IF NOT EXISTS uq_fund_shares_invoice ON fund_shares (society_id, invoice_number);`, 'fund shares invoice unique');
        await runSafe(() => client`
          CREATE TABLE IF NOT EXISTS fund_payments (
            id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
            society_id uuid NOT NULL REFERENCES societies(id) ON DELETE CASCADE,
            campaign_id uuid NOT NULL REFERENCES fund_campaigns(id) ON DELETE CASCADE,
            share_id uuid REFERENCES fund_shares(id) ON DELETE SET NULL,
            flat_id uuid REFERENCES flats(id) ON DELETE SET NULL,
            payer_name varchar(150),
            amount numeric(12,2) NOT NULL,
            paid_at date NOT NULL,
            payment_mode varchar(20) NOT NULL,
            bank_account_id uuid REFERENCES bank_accounts(id) ON DELETE SET NULL,
            reference varchar(100),
            receipt_number varchar(30) NOT NULL,
            voucher_id uuid REFERENCES vouchers(id) ON DELETE SET NULL,
            recorded_by uuid REFERENCES users(id) ON DELETE SET NULL,
            created_at timestamptz NOT NULL DEFAULT now()
          );`, 'fund_payments table');
        await runSafe(() => client`CREATE INDEX IF NOT EXISTS idx_fund_payments_campaign ON fund_payments (campaign_id);`, 'fund payments index');
        await runSafe(() => client`CREATE UNIQUE INDEX IF NOT EXISTS uq_fund_payments_receipt ON fund_payments (society_id, receipt_number);`, 'fund payments receipt unique');
        await runSafe(() => client`
          CREATE TABLE IF NOT EXISTS fund_expenses (
            id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
            society_id uuid NOT NULL REFERENCES societies(id) ON DELETE CASCADE,
            campaign_id uuid NOT NULL REFERENCES fund_campaigns(id) ON DELETE CASCADE,
            description varchar(255) NOT NULL,
            vendor_name varchar(150),
            bill_number varchar(100),
            amount numeric(12,2) NOT NULL,
            spent_at date NOT NULL,
            payment_mode varchar(20) NOT NULL,
            bank_account_id uuid REFERENCES bank_accounts(id) ON DELETE SET NULL,
            voucher_id uuid REFERENCES vouchers(id) ON DELETE SET NULL,
            recorded_by uuid REFERENCES users(id) ON DELETE SET NULL,
            created_at timestamptz NOT NULL DEFAULT now()
          );`, 'fund_expenses table');
        await runSafe(() => client`CREATE INDEX IF NOT EXISTS idx_fund_expenses_campaign ON fund_expenses (campaign_id);`, 'fund expenses index');

        // Chat.
        await runSafe(() => client`
          CREATE TABLE IF NOT EXISTS chat_channels (
            id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
            society_id uuid NOT NULL REFERENCES societies(id) ON DELETE CASCADE,
            type varchar(20) NOT NULL,
            name varchar(150),
            direct_key varchar(80),
            created_by uuid REFERENCES users(id) ON DELETE SET NULL,
            last_message_at timestamptz,
            created_at timestamptz NOT NULL DEFAULT now()
          );`, 'chat_channels table');
        await runSafe(() => client`CREATE UNIQUE INDEX IF NOT EXISTS uq_chat_channels_group ON chat_channels (society_id, type) WHERE type IN ('SOCIETY', 'COMMITTEE');`, 'chat group unique');
        await runSafe(() => client`CREATE UNIQUE INDEX IF NOT EXISTS uq_chat_channels_direct ON chat_channels (society_id, direct_key) WHERE type = 'DIRECT';`, 'chat direct unique');
        await runSafe(() => client`
          CREATE TABLE IF NOT EXISTS chat_direct_members (
            id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
            channel_id uuid NOT NULL REFERENCES chat_channels(id) ON DELETE CASCADE,
            user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE
          );`, 'chat_direct_members table');
        await runSafe(() => client`CREATE UNIQUE INDEX IF NOT EXISTS uq_chat_direct_members ON chat_direct_members (channel_id, user_id);`, 'chat direct members unique');
        await runSafe(() => client`CREATE INDEX IF NOT EXISTS idx_chat_direct_members_user ON chat_direct_members (user_id);`, 'chat direct members index');
        await runSafe(() => client`
          CREATE TABLE IF NOT EXISTS chat_messages (
            id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
            society_id uuid NOT NULL REFERENCES societies(id) ON DELETE CASCADE,
            channel_id uuid NOT NULL REFERENCES chat_channels(id) ON DELETE CASCADE,
            sender_id uuid REFERENCES users(id) ON DELETE SET NULL,
            body text,
            photo_url text,
            photo_key text,
            reply_to_id uuid,
            edited_at timestamptz,
            deleted_at timestamptz,
            deleted_by uuid REFERENCES users(id) ON DELETE SET NULL,
            created_at timestamptz NOT NULL DEFAULT now()
          );`, 'chat_messages table');
        await runSafe(() => client`CREATE INDEX IF NOT EXISTS idx_chat_messages_channel ON chat_messages (channel_id, created_at);`, 'chat messages index');
        await runSafe(() => client`
          CREATE TABLE IF NOT EXISTS chat_reads (
            id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
            channel_id uuid NOT NULL REFERENCES chat_channels(id) ON DELETE CASCADE,
            user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
            last_read_at timestamptz NOT NULL DEFAULT now()
          );`, 'chat_reads table');
        await runSafe(() => client`CREATE UNIQUE INDEX IF NOT EXISTS uq_chat_reads ON chat_reads (channel_id, user_id);`, 'chat reads unique');
        await runSafe(() => client`
          CREATE TABLE IF NOT EXISTS chat_mutes (
            id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
            society_id uuid NOT NULL REFERENCES societies(id) ON DELETE CASCADE,
            user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
            muted_until timestamptz NOT NULL,
            reason text,
            muted_by uuid REFERENCES users(id) ON DELETE SET NULL,
            created_at timestamptz NOT NULL DEFAULT now()
          );`, 'chat_mutes table');
        await runSafe(() => client`CREATE UNIQUE INDEX IF NOT EXISTS uq_chat_mutes ON chat_mutes (society_id, user_id);`, 'chat mutes unique');

        // Complaints about common areas have no flat.
        await runSafe(() => client`ALTER TABLE complaints ALTER COLUMN flat_id DROP NOT NULL;`, 'complaints flat optional');

        // Error log grouped by code.
        await runSafe(() => client`
          CREATE TABLE IF NOT EXISTS error_logs (
            id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
            code varchar(12) NOT NULL,
            source varchar(20) NOT NULL,
            level varchar(10) NOT NULL,
            known_problem varchar(12),
            message text NOT NULL,
            "where" text,
            stack text,
            count integer NOT NULL DEFAULT 1,
            samples jsonb NOT NULL DEFAULT '[]'::jsonb,
            first_seen timestamptz NOT NULL DEFAULT now(),
            last_seen timestamptz NOT NULL DEFAULT now(),
            resolved_at timestamptz
          );`, 'error_logs table');
        await runSafe(() => client`CREATE UNIQUE INDEX IF NOT EXISTS uq_error_logs_code ON error_logs (code);`, 'error_logs code unique');

        // Meeting proxies.
        await runSafe(() => client`ALTER TABLE meetings ADD COLUMN IF NOT EXISTS allow_proxy boolean NOT NULL DEFAULT false;`, 'meetings allow_proxy');
        await runSafe(() => client`ALTER TABLE meetings ADD COLUMN IF NOT EXISTS proxy_limit integer NOT NULL DEFAULT 1;`, 'meetings proxy_limit');
        await runSafe(() => client`ALTER TABLE meetings ADD COLUMN IF NOT EXISTS proxies_count_for_quorum boolean NOT NULL DEFAULT false;`, 'meetings proxies quorum');
        await runSafe(() => client`ALTER TABLE meeting_attendance ADD COLUMN IF NOT EXISTS via_proxy_id uuid;`, 'attendance via proxy');
        await runSafe(() => client`ALTER TABLE resolution_votes ADD COLUMN IF NOT EXISTS cast_by_proxy_user_id uuid REFERENCES users(id) ON DELETE SET NULL;`, 'votes cast by proxy');
        await runSafe(() => client`
          CREATE TABLE IF NOT EXISTS meeting_proxies (
            id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
            society_id uuid NOT NULL REFERENCES societies(id) ON DELETE CASCADE,
            meeting_id uuid NOT NULL REFERENCES meetings(id) ON DELETE CASCADE,
            member_user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
            proxy_user_id uuid REFERENCES users(id) ON DELETE CASCADE,
            proxy_name varchar(150),
            recorded_by uuid REFERENCES users(id) ON DELETE SET NULL,
            note text,
            revoked_at timestamptz,
            created_at timestamptz NOT NULL DEFAULT now()
          );`, 'meeting_proxies table');
        await runSafe(() => client`CREATE UNIQUE INDEX IF NOT EXISTS uq_meeting_proxies_active ON meeting_proxies (meeting_id, member_user_id) WHERE revoked_at IS NULL;`, 'proxies active unique');

        // Reminders (sent once, the day before).
        await runSafe(() => client`ALTER TABLE meetings ADD COLUMN IF NOT EXISTS reminder_sent_at timestamptz;`, 'meetings reminder_sent_at');
        await runSafe(() => client`ALTER TABLE meeting_resolutions ADD COLUMN IF NOT EXISTS reminder_sent_at timestamptz;`, 'resolutions reminder_sent_at');

        // Funds: accrual option, reversals, asset purchases, resident-reported and online payments.
        await runSafe(() => client`ALTER TABLE fund_campaigns ADD COLUMN IF NOT EXISTS accounting_mode varchar(10) NOT NULL DEFAULT 'CASH';`, 'funds accounting_mode');
        await runSafe(() => client`ALTER TABLE fund_campaigns ADD COLUMN IF NOT EXISTS issue_voucher_id uuid REFERENCES vouchers(id) ON DELETE SET NULL;`, 'funds issue voucher');
        await runSafe(() => client`ALTER TABLE fund_shares ADD COLUMN IF NOT EXISTS waive_voucher_id uuid REFERENCES vouchers(id) ON DELETE SET NULL;`, 'fund shares waive voucher');
        await runSafe(() => client`ALTER TABLE fund_payments ADD COLUMN IF NOT EXISTS source varchar(10) NOT NULL DEFAULT 'OFFICE';`, 'fund payments source');
        await runSafe(() => client`ALTER TABLE fund_payments ADD COLUMN IF NOT EXISTS razorpay_payment_id varchar(60);`, 'fund payments razorpay');
        await runSafe(() => client`ALTER TABLE fund_payments ADD COLUMN IF NOT EXISTS reversed_at timestamptz;`, 'fund payments reversed_at');
        await runSafe(() => client`ALTER TABLE fund_payments ADD COLUMN IF NOT EXISTS reversed_by uuid REFERENCES users(id) ON DELETE SET NULL;`, 'fund payments reversed_by');
        await runSafe(() => client`ALTER TABLE fund_payments ADD COLUMN IF NOT EXISTS reverse_reason text;`, 'fund payments reverse_reason');
        await runSafe(() => client`ALTER TABLE fund_payments ADD COLUMN IF NOT EXISTS reversal_voucher_id uuid REFERENCES vouchers(id) ON DELETE SET NULL;`, 'fund payments reversal voucher');
        await runSafe(() => client`CREATE UNIQUE INDEX IF NOT EXISTS uq_fund_payments_razorpay ON fund_payments (razorpay_payment_id) WHERE razorpay_payment_id IS NOT NULL;`, 'fund payments razorpay unique');
        await runSafe(() => client`ALTER TABLE fund_expenses ADD COLUMN IF NOT EXISTS asset_ledger_id uuid REFERENCES ledgers(id) ON DELETE SET NULL;`, 'fund expenses asset');
        await runSafe(() => client`
          CREATE TABLE IF NOT EXISTS fund_payment_claims (
            id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
            society_id uuid NOT NULL REFERENCES societies(id) ON DELETE CASCADE,
            campaign_id uuid NOT NULL REFERENCES fund_campaigns(id) ON DELETE CASCADE,
            share_id uuid REFERENCES fund_shares(id) ON DELETE CASCADE,
            flat_id uuid REFERENCES flats(id) ON DELETE SET NULL,
            amount numeric(12,2) NOT NULL,
            paid_at date NOT NULL,
            payment_mode varchar(20) NOT NULL,
            reference varchar(100),
            note text,
            proof_url text,
            status varchar(20) NOT NULL DEFAULT 'PENDING',
            submitted_by uuid REFERENCES users(id) ON DELETE SET NULL,
            decided_by uuid REFERENCES users(id) ON DELETE SET NULL,
            decided_at timestamptz,
            reject_reason text,
            payment_id uuid REFERENCES fund_payments(id) ON DELETE SET NULL,
            created_at timestamptz NOT NULL DEFAULT now()
          );`, 'fund_payment_claims table');
        await runSafe(() => client`CREATE INDEX IF NOT EXISTS idx_fund_claims_campaign ON fund_payment_claims (campaign_id, status);`, 'fund claims index');
        await runSafe(() => client`
          CREATE TABLE IF NOT EXISTS fund_online_orders (
            id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
            society_id uuid NOT NULL REFERENCES societies(id) ON DELETE CASCADE,
            campaign_id uuid NOT NULL REFERENCES fund_campaigns(id) ON DELETE CASCADE,
            share_id uuid REFERENCES fund_shares(id) ON DELETE CASCADE,
            user_id uuid REFERENCES users(id) ON DELETE SET NULL,
            razorpay_order_id varchar(60) NOT NULL,
            amount numeric(12,2) NOT NULL,
            status varchar(20) NOT NULL DEFAULT 'CREATED',
            payment_id uuid REFERENCES fund_payments(id) ON DELETE SET NULL,
            created_at timestamptz NOT NULL DEFAULT now()
          );`, 'fund_online_orders table');
        await runSafe(() => client`CREATE UNIQUE INDEX IF NOT EXISTS uq_fund_online_orders ON fund_online_orders (razorpay_order_id);`, 'fund online orders unique');
        await runSafe(() => client`CREATE UNIQUE INDEX IF NOT EXISTS uq_ledgers_system_key ON ledgers (society_id, system_key) WHERE system_key IS NOT NULL;`, 'ledgers system_key unique');

        return drizzle(client, { schema });
      },
    },
  ],
  exports: [DRIZZLE_PROVIDER],
})
export class DatabaseModule {}
export type DrizzleDB = ReturnType<typeof drizzle<typeof schema>>;
