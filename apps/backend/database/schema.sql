-- =============================================================================
-- Society Management SaaS Platform for India - Complete DDL Schema
-- =============================================================================
-- Designed for 10,000+ Societies with complete tenant isolation.
-- Multi-Tenant Pattern: Column-Isolation using `society_id` on all tenant tables.
-- =============================================================================

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- -----------------------------------------------------------------------------
-- 1. IDENTITY & SYSTEM CONFIGURATION
-- -----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS "societies" (
    "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
    "name" varchar(255) NOT NULL,
    "slug" varchar(100) NOT NULL UNIQUE,
    "address" text,
    "gstin" varchar(15),
    "pan" varchar(10),
    "tan" varchar(10),
    "registration_number" varchar(100),
    "is_active" boolean DEFAULT true NOT NULL,
    "created_at" timestamp with time zone DEFAULT now() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
    "deleted_at" timestamp with time zone
);
CREATE INDEX IF NOT EXISTS "idx_societies_slug" ON "societies" ("slug");

CREATE TABLE IF NOT EXISTS "users" (
    "id" uuid PRIMARY KEY NOT NULL, -- Corresponds directly to Supabase Auth UUID
    "email" varchar(255) NOT NULL UNIQUE,
    "name" varchar(255),
    "mobile" varchar(15),
    "avatar_url" text,
    "is_active" boolean DEFAULT true NOT NULL,
    "created_at" timestamp with time zone DEFAULT now() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
    "deleted_at" timestamp with time zone
);

CREATE TABLE IF NOT EXISTS "roles" (
    "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
    "name" varchar(50) NOT NULL UNIQUE,
    "description" text,
    "created_at" timestamp with time zone DEFAULT now() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "permissions" (
    "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
    "key" varchar(100) NOT NULL UNIQUE,
    "description" text,
    "created_at" timestamp with time zone DEFAULT now() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "role_permissions" (
    "role_id" uuid NOT NULL REFERENCES "roles"("id") ON DELETE CASCADE,
    "permission_id" uuid NOT NULL REFERENCES "permissions"("id") ON DELETE CASCADE,
    PRIMARY KEY ("role_id", "permission_id")
);

CREATE TABLE IF NOT EXISTS "user_societies" (
    "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
    "user_id" uuid NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
    "society_id" uuid NOT NULL REFERENCES "societies"("id") ON DELETE CASCADE,
    "role_id" uuid NOT NULL REFERENCES "roles"("id") ON DELETE RESTRICT,
    "created_at" timestamp with time zone DEFAULT now() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
CREATE INDEX IF NOT EXISTS "idx_user_societies_search" ON "user_societies" ("user_id", "society_id");

-- -----------------------------------------------------------------------------
-- 2. PHYSICAL LAYOUT (LAYOUT STRUCTURE)
-- -----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS "buildings" (
    "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
    "society_id" uuid NOT NULL REFERENCES "societies"("id") ON DELETE CASCADE,
    "name" varchar(100) NOT NULL,
    "created_at" timestamp with time zone DEFAULT now() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
CREATE INDEX IF NOT EXISTS "idx_buildings_society" ON "buildings" ("society_id");

CREATE TABLE IF NOT EXISTS "wings" (
    "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
    "society_id" uuid NOT NULL REFERENCES "societies"("id") ON DELETE CASCADE,
    "building_id" uuid NOT NULL REFERENCES "buildings"("id") ON DELETE CASCADE,
    "name" varchar(50) NOT NULL,
    "created_at" timestamp with time zone DEFAULT now() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
CREATE INDEX IF NOT EXISTS "idx_wings_society" ON "wings" ("society_id");

CREATE TABLE IF NOT EXISTS "floors" (
    "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
    "society_id" uuid NOT NULL REFERENCES "societies"("id") ON DELETE CASCADE,
    "wing_id" uuid NOT NULL REFERENCES "wings"("id") ON DELETE CASCADE,
    "number" integer NOT NULL,
    "created_at" timestamp with time zone DEFAULT now() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
CREATE INDEX IF NOT EXISTS "idx_floors_society" ON "floors" ("society_id");

CREATE TABLE IF NOT EXISTS "flats" (
    "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
    "society_id" uuid NOT NULL REFERENCES "societies"("id") ON DELETE CASCADE,
    "floor_id" uuid NOT NULL REFERENCES "floors"("id") ON DELETE CASCADE,
    "number" varchar(50) NOT NULL,
    "sqft_area" numeric(10, 2) NOT NULL,
    "flat_type" varchar(50) NOT NULL,
    "created_at" timestamp with time zone DEFAULT now() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
    "deleted_at" timestamp with time zone
);
CREATE INDEX IF NOT EXISTS "idx_flats_society" ON "flats" ("society_id");

-- -----------------------------------------------------------------------------
-- 3. RESIDENTS & OCCUPANCY
-- -----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS "owners" (
    "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
    "society_id" uuid NOT NULL REFERENCES "societies"("id") ON DELETE CASCADE,
    "user_id" uuid NOT NULL REFERENCES "users"("id") ON DELETE RESTRICT,
    "pan" varchar(10),
    "aadhaar" varchar(12),
    "emergency_contact" varchar(100),
    "created_at" timestamp with time zone DEFAULT now() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
CREATE INDEX IF NOT EXISTS "idx_owners_society" ON "owners" ("society_id");

CREATE TABLE IF NOT EXISTS "flat_owners" (
    "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
    "flat_id" uuid NOT NULL REFERENCES "flats"("id") ON DELETE CASCADE,
    "owner_id" uuid NOT NULL REFERENCES "owners"("id") ON DELETE CASCADE,
    "is_primary" boolean DEFAULT true NOT NULL,
    "is_current" boolean DEFAULT true NOT NULL,
    "start_date" date DEFAULT CURRENT_DATE NOT NULL,
    "end_date" date,
    "ownership_share" numeric(5, 2),
    "notes" text,
    "created_at" timestamp with time zone DEFAULT now() NOT NULL
);
CREATE INDEX IF NOT EXISTS "idx_flat_owners_flat" ON "flat_owners" ("flat_id");

CREATE TABLE IF NOT EXISTS "tenants" (
    "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
    "society_id" uuid NOT NULL REFERENCES "societies"("id") ON DELETE CASCADE,
    "user_id" uuid NOT NULL REFERENCES "users"("id") ON DELETE RESTRICT,
    "police_verified" boolean DEFAULT false NOT NULL,
    "police_verification_date" date,
    "created_at" timestamp with time zone DEFAULT now() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
CREATE INDEX IF NOT EXISTS "idx_tenants_society" ON "tenants" ("society_id");

CREATE TABLE IF NOT EXISTS "flat_tenants" (
    "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
    "society_id" uuid NOT NULL REFERENCES "societies"("id") ON DELETE CASCADE,
    "flat_id" uuid NOT NULL REFERENCES "flats"("id") ON DELETE CASCADE,
    "tenant_id" uuid NOT NULL REFERENCES "tenants"("id") ON DELETE CASCADE,
    "lease_start" date NOT NULL,
    "lease_end" date NOT NULL,
    "is_active" boolean DEFAULT true NOT NULL,
    "created_at" timestamp with time zone DEFAULT now() NOT NULL
);
CREATE INDEX IF NOT EXISTS "idx_flat_tenants_society" ON "flat_tenants" ("society_id");

CREATE TABLE IF NOT EXISTS "members" (
    "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
    "society_id" uuid NOT NULL REFERENCES "societies"("id") ON DELETE CASCADE,
    "user_id" uuid NOT NULL REFERENCES "users"("id") ON DELETE RESTRICT,
    "membership_number" varchar(50) NOT NULL,
    "status" varchar(50) DEFAULT 'ACTIVE' NOT NULL,
    "created_at" timestamp with time zone DEFAULT now() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
CREATE INDEX IF NOT EXISTS "idx_members_society" ON "members" ("society_id");
CREATE UNIQUE INDEX IF NOT EXISTS "uq_membership_society" ON "members" ("society_id", "membership_number");

-- -----------------------------------------------------------------------------
-- 4. FINANCIALS & CHART OF ACCOUNTS (DOUBLE ENTRY)
-- -----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS "ledgers" (
    "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
    "society_id" uuid NOT NULL REFERENCES "societies"("id") ON DELETE CASCADE,
    "name" varchar(255) NOT NULL,
    "group" varchar(100) NOT NULL,
    "code" varchar(50),
    "is_active" boolean DEFAULT true NOT NULL,
    "created_at" timestamp with time zone DEFAULT now() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
CREATE INDEX IF NOT EXISTS "idx_ledgers_society" ON "ledgers" ("society_id");

CREATE TABLE IF NOT EXISTS "bank_accounts" (
    "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
    "society_id" uuid NOT NULL REFERENCES "societies"("id") ON DELETE CASCADE,
    "ledger_id" uuid NOT NULL REFERENCES "ledgers"("id") ON DELETE RESTRICT,
    "bank_name" varchar(150) NOT NULL,
    "account_number" varchar(50) NOT NULL,
    "ifsc" varchar(11) NOT NULL,
    "branch_name" varchar(150),
    "type" varchar(50) DEFAULT 'SAVINGS' NOT NULL,
    "opening_balance" numeric(12, 2) DEFAULT '0.00' NOT NULL,
    "is_default" boolean DEFAULT false NOT NULL,
    "created_at" timestamp with time zone DEFAULT now() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
CREATE INDEX IF NOT EXISTS "idx_bank_accounts_society" ON "bank_accounts" ("society_id");

CREATE TABLE IF NOT EXISTS "maintenance_heads" (
    "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
    "society_id" uuid NOT NULL REFERENCES "societies"("id") ON DELETE CASCADE,
    "ledger_id" uuid NOT NULL REFERENCES "ledgers"("id") ON DELETE RESTRICT,
    "name" varchar(150) NOT NULL,
    "description" text,
    "created_at" timestamp with time zone DEFAULT now() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
CREATE INDEX IF NOT EXISTS "idx_m_heads_society" ON "maintenance_heads" ("society_id");

CREATE TABLE IF NOT EXISTS "maintenance_rates" (
    "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
    "society_id" uuid NOT NULL REFERENCES "societies"("id") ON DELETE CASCADE,
    "head_id" uuid NOT NULL REFERENCES "maintenance_heads"("id") ON DELETE CASCADE,
    "flat_type" varchar(50) NOT NULL,
    "calculation_type" varchar(50) NOT NULL,
    "rate" numeric(12, 2) NOT NULL,
    "created_at" timestamp with time zone DEFAULT now() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
CREATE INDEX IF NOT EXISTS "idx_m_rates_society" ON "maintenance_rates" ("society_id");

CREATE TABLE IF NOT EXISTS "maintenance_bills" (
    "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
    "society_id" uuid NOT NULL REFERENCES "societies"("id") ON DELETE CASCADE,
    "flat_id" uuid NOT NULL REFERENCES "flats"("id") ON DELETE RESTRICT,
    "bill_number" varchar(50) NOT NULL,
    "billing_period_start" date NOT NULL,
    "billing_period_end" date NOT NULL,
    "due_date" date NOT NULL,
    "total_amount" numeric(12, 2) NOT NULL,
    "status" varchar(50) DEFAULT 'UNPAID' NOT NULL,
    "created_at" timestamp with time zone DEFAULT now() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
CREATE INDEX IF NOT EXISTS "idx_m_bills_society" ON "maintenance_bills" ("society_id");

CREATE TABLE IF NOT EXISTS "bill_items" (
    "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
    "society_id" uuid NOT NULL REFERENCES "societies"("id") ON DELETE CASCADE,
    "bill_id" uuid NOT NULL REFERENCES "maintenance_bills"("id") ON DELETE CASCADE,
    "head_id" uuid NOT NULL REFERENCES "maintenance_heads"("id") ON DELETE RESTRICT,
    "amount" numeric(12, 2) NOT NULL
);
CREATE INDEX IF NOT EXISTS "idx_bill_items_society" ON "bill_items" ("society_id");

CREATE TABLE IF NOT EXISTS "receipts" (
    "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
    "society_id" uuid NOT NULL REFERENCES "societies"("id") ON DELETE CASCADE,
    "bill_id" uuid NOT NULL REFERENCES "maintenance_bills"("id") ON DELETE RESTRICT,
    "receipt_number" varchar(50) NOT NULL,
    "amount_paid" numeric(12, 2) NOT NULL,
    "payment_mode" varchar(50) NOT NULL,
    "payment_date" date NOT NULL,
    "reference_number" varchar(100),
    "cheque_status" varchar(50),
    "created_at" timestamp with time zone DEFAULT now() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
CREATE INDEX IF NOT EXISTS "idx_receipts_society" ON "receipts" ("society_id");

CREATE TABLE IF NOT EXISTS "vendors" (
    "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
    "society_id" uuid NOT NULL REFERENCES "societies"("id") ON DELETE CASCADE,
    "name" varchar(255) NOT NULL,
    "contact_person" varchar(150),
    "email" varchar(255),
    "mobile" varchar(15),
    "gstin" varchar(15),
    "pan" varchar(10),
    "created_at" timestamp with time zone DEFAULT now() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
CREATE INDEX IF NOT EXISTS "idx_vendors_society" ON "vendors" ("society_id");

CREATE TABLE IF NOT EXISTS "vouchers" (
    "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
    "society_id" uuid NOT NULL REFERENCES "societies"("id") ON DELETE CASCADE,
    "voucher_number" varchar(50) NOT NULL,
    "type" varchar(50) NOT NULL,
    "date" date NOT NULL,
    "narration" text,
    "created_at" timestamp with time zone DEFAULT now() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
CREATE INDEX IF NOT EXISTS "idx_vouchers_society" ON "vouchers" ("society_id");

CREATE TABLE IF NOT EXISTS "transactions" (
    "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
    "society_id" uuid NOT NULL REFERENCES "societies"("id") ON DELETE CASCADE,
    "voucher_id" uuid NOT NULL REFERENCES "vouchers"("id") ON DELETE CASCADE,
    "ledger_id" uuid NOT NULL REFERENCES "ledgers"("id") ON DELETE RESTRICT,
    "type" varchar(10) NOT NULL, -- 'DEBIT', 'CREDIT'
    "amount" numeric(12, 2) NOT NULL
);
CREATE INDEX IF NOT EXISTS "idx_transactions_society" ON "transactions" ("society_id");

CREATE TABLE IF NOT EXISTS "expenses" (
    "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
    "society_id" uuid NOT NULL REFERENCES "societies"("id") ON DELETE CASCADE,
    "voucher_id" uuid REFERENCES "vouchers"("id") ON DELETE RESTRICT,
    "vendor_id" uuid REFERENCES "vendors"("id") ON DELETE RESTRICT,
    "bill_number" varchar(100),
    "amount" numeric(12, 2) NOT NULL,
    "date" date NOT NULL,
    "status" varchar(50) DEFAULT 'UNPAID' NOT NULL,
    "approval_status" varchar(50) DEFAULT 'APPROVED' NOT NULL,
    "created_at" timestamp with time zone DEFAULT now() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
CREATE INDEX IF NOT EXISTS "idx_expenses_society" ON "expenses" ("society_id");

-- -----------------------------------------------------------------------------
-- 5. UTILITY & SECURITY WORKFLOWS
-- -----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS "parking_slots" (
    "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
    "society_id" uuid NOT NULL REFERENCES "societies"("id") ON DELETE CASCADE,
    "flat_id" uuid REFERENCES "flats"("id") ON DELETE SET NULL,
    "slot_number" varchar(50) NOT NULL,
    "type" varchar(50) DEFAULT 'OPEN' NOT NULL,
    "charges" numeric(8, 2) DEFAULT '0.00' NOT NULL,
    "created_at" timestamp with time zone DEFAULT now() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
CREATE INDEX IF NOT EXISTS "idx_parking_slots_society" ON "parking_slots" ("society_id");

CREATE TABLE IF NOT EXISTS "vehicles" (
    "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
    "society_id" uuid NOT NULL REFERENCES "societies"("id") ON DELETE CASCADE,
    "flat_id" uuid NOT NULL REFERENCES "flats"("id") ON DELETE CASCADE,
    "parking_slot_id" uuid REFERENCES "parking_slots"("id") ON DELETE SET NULL,
    "number" varchar(50) NOT NULL,
    "type" varchar(20) DEFAULT 'FOUR_WHEELER' NOT NULL,
    "make" varchar(100),
    "model" varchar(100),
    "created_at" timestamp with time zone DEFAULT now() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
CREATE INDEX IF NOT EXISTS "idx_vehicles_society" ON "vehicles" ("society_id");

CREATE TABLE IF NOT EXISTS "visitors" (
    "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
    "society_id" uuid NOT NULL REFERENCES "societies"("id") ON DELETE CASCADE,
    "flat_id" uuid NOT NULL REFERENCES "flats"("id") ON DELETE RESTRICT,
    "name" varchar(150) NOT NULL,
    "mobile" varchar(15) NOT NULL,
    "vehicle_number" varchar(50),
    "type" varchar(50) DEFAULT 'GUEST' NOT NULL,
    "company" varchar(100),
    "purpose" text,
    "entry_time" timestamp with time zone DEFAULT now() NOT NULL,
    "exit_time" timestamp with time zone,
    "gate_no" varchar(50),
    "created_at" timestamp with time zone DEFAULT now() NOT NULL
);
CREATE INDEX IF NOT EXISTS "idx_visitors_society" ON "visitors" ("society_id");

CREATE TABLE IF NOT EXISTS "staff" (
    "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
    "society_id" uuid NOT NULL REFERENCES "societies"("id") ON DELETE CASCADE,
    "name" varchar(150) NOT NULL,
    "mobile" varchar(15) NOT NULL,
    "role" varchar(100) NOT NULL,
    "salary" numeric(10, 2) DEFAULT '0.00',
    "is_available" boolean DEFAULT true NOT NULL,
    "created_at" timestamp with time zone DEFAULT now() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
CREATE INDEX IF NOT EXISTS "idx_staff_society" ON "staff" ("society_id");

CREATE TABLE IF NOT EXISTS "staff_attendance" (
    "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
    "society_id" uuid NOT NULL REFERENCES "societies"("id") ON DELETE CASCADE,
    "staff_id" uuid NOT NULL REFERENCES "staff"("id") ON DELETE CASCADE,
    "date" date NOT NULL,
    "check_in" timestamp with time zone,
    "check_out" timestamp with time zone,
    "status" varchar(20) DEFAULT 'PRESENT' NOT NULL
);
CREATE INDEX IF NOT EXISTS "idx_staff_attendance_society" ON "staff_attendance" ("society_id");

CREATE TABLE IF NOT EXISTS "staff_leaves" (
    "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
    "society_id" uuid NOT NULL REFERENCES "societies"("id") ON DELETE CASCADE,
    "staff_id" uuid NOT NULL REFERENCES "staff"("id") ON DELETE CASCADE,
    "start_date" date NOT NULL,
    "end_date" date NOT NULL,
    "reason" text,
    "status" varchar(50) DEFAULT 'PENDING' NOT NULL,
    "created_at" timestamp with time zone DEFAULT now() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
CREATE INDEX IF NOT EXISTS "idx_staff_leaves_society" ON "staff_leaves" ("society_id");

CREATE TABLE IF NOT EXISTS "staff_salaries" (
    "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
    "society_id" uuid NOT NULL REFERENCES "societies"("id") ON DELETE CASCADE,
    "staff_id" uuid NOT NULL REFERENCES "staff"("id") ON DELETE CASCADE,
    "month" integer NOT NULL,
    "year" integer NOT NULL,
    "base_amount" numeric(10, 2) NOT NULL,
    "bonus" numeric(10, 2) DEFAULT '0.00',
    "deductions" numeric(10, 2) DEFAULT '0.00',
    "paid_at" timestamp with time zone,
    "payment_mode" varchar(50),
    "created_at" timestamp with time zone DEFAULT now() NOT NULL
);
CREATE INDEX IF NOT EXISTS "idx_staff_salaries_society" ON "staff_salaries" ("society_id");

CREATE TABLE IF NOT EXISTS "complaints" (
    "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
    "society_id" uuid NOT NULL REFERENCES "societies"("id") ON DELETE CASCADE,
    "flat_id" uuid NOT NULL REFERENCES "flats"("id") ON DELETE CASCADE,
    "raised_by_user_id" uuid NOT NULL REFERENCES "users"("id") ON DELETE RESTRICT,
    "assigned_staff_id" uuid REFERENCES "staff"("id") ON DELETE SET NULL,
    "title" varchar(255) NOT NULL,
    "description" text NOT NULL,
    "status" varchar(50) DEFAULT 'OPEN' NOT NULL,
    "priority" varchar(20) DEFAULT 'MEDIUM' NOT NULL,
    "resident_feedback" text,
    "created_at" timestamp with time zone DEFAULT now() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
    "deleted_at" timestamp with time zone
);
CREATE INDEX IF NOT EXISTS "idx_complaints_society" ON "complaints" ("society_id");

CREATE TABLE IF NOT EXISTS "assets" (
    "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
    "society_id" uuid NOT NULL REFERENCES "societies"("id") ON DELETE CASCADE,
    "name" varchar(255) NOT NULL,
    "type" varchar(100),
    "purchase_date" date,
    "cost" numeric(12, 2),
    "warranty_expiry" date,
    "amc_provider" varchar(255),
    "amc_cost" numeric(10, 2),
    "next_service_date" date,
    "created_at" timestamp with time zone DEFAULT now() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
CREATE INDEX IF NOT EXISTS "idx_assets_society" ON "assets" ("society_id");

-- -----------------------------------------------------------------------------
-- 6. COMMUNICATION, LOGS, AND SYSTEM SETTINGS
-- -----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS "notices" (
    "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
    "society_id" uuid NOT NULL REFERENCES "societies"("id") ON DELETE CASCADE,
    "title" varchar(255) NOT NULL,
    "content" text NOT NULL,
    "type" varchar(50) DEFAULT 'GENERAL' NOT NULL,
    "expires_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT now() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
    "deleted_at" timestamp with time zone
);
CREATE INDEX IF NOT EXISTS "idx_notices_society" ON "notices" ("society_id");

CREATE TABLE IF NOT EXISTS "meetings" (
    "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
    "society_id" uuid NOT NULL REFERENCES "societies"("id") ON DELETE CASCADE,
    "title" varchar(255) NOT NULL,
    "description" text,
    "scheduled_at" timestamp with time zone NOT NULL,
    "location" varchar(255) NOT NULL,
    "type" varchar(50) DEFAULT 'COMMITTEE' NOT NULL,
    "created_at" timestamp with time zone DEFAULT now() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
CREATE INDEX IF NOT EXISTS "idx_meetings_society" ON "meetings" ("society_id");

CREATE TABLE IF NOT EXISTS "meeting_minutes" (
    "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
    "society_id" uuid NOT NULL REFERENCES "societies"("id") ON DELETE CASCADE,
    "meeting_id" uuid NOT NULL UNIQUE REFERENCES "meetings"("id") ON DELETE CASCADE,
    "minutes_content" text NOT NULL,
    "created_at" timestamp with time zone DEFAULT now() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "documents" (
    "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
    "society_id" uuid NOT NULL REFERENCES "societies"("id") ON DELETE CASCADE,
    "name" varchar(255) NOT NULL,
    "file_url" text NOT NULL,
    "file_size" integer,
    "category" varchar(100) NOT NULL,
    "is_private" boolean DEFAULT false NOT NULL,
    "created_at" timestamp with time zone DEFAULT now() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
    "deleted_at" timestamp with time zone
);
CREATE INDEX IF NOT EXISTS "idx_documents_society" ON "documents" ("society_id");

CREATE TABLE IF NOT EXISTS "notifications" (
    "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
    "society_id" uuid NOT NULL REFERENCES "societies"("id") ON DELETE CASCADE,
    "recipient_user_id" uuid REFERENCES "users"("id") ON DELETE SET NULL,
    "recipient_contact" varchar(255) NOT NULL,
    "channel" varchar(20) NOT NULL, -- 'EMAIL', 'SMS', 'WHATSAPP', 'PUSH'
    "title" varchar(255),
    "body" text NOT NULL,
    "status" varchar(20) DEFAULT 'PENDING' NOT NULL,
    "error_details" text,
    "sent_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT now() NOT NULL
);
CREATE INDEX IF NOT EXISTS "idx_notifications_society" ON "notifications" ("society_id");

CREATE TABLE IF NOT EXISTS "audit_logs" (
    "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
    "society_id" uuid REFERENCES "societies"("id") ON DELETE SET NULL,
    "user_id" uuid REFERENCES "users"("id") ON DELETE SET NULL,
    "action" varchar(100) NOT NULL,
    "entity_name" varchar(100) NOT NULL,
    "entity_id" uuid,
    "old_values" jsonb,
    "new_values" jsonb,
    "ip_address" varchar(50),
    "user_agent" text,
    "created_at" timestamp with time zone DEFAULT now() NOT NULL
);
CREATE INDEX IF NOT EXISTS "idx_audit_logs_society" ON "audit_logs" ("society_id");

CREATE TABLE IF NOT EXISTS "settings" (
    "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
    "society_id" uuid NOT NULL UNIQUE REFERENCES "societies"("id") ON DELETE CASCADE,
    "financial_year_start" date DEFAULT '2026-04-01' NOT NULL,
    "billing_frequency" varchar(50) DEFAULT 'MONTHLY' NOT NULL,
    "penalty_interest_rate" numeric(5, 2) DEFAULT '12.00' NOT NULL,
    "invoice_due_days" integer DEFAULT 15 NOT NULL,
    "maintenance_formula" text DEFAULT '(area * rate) + parking + water' NOT NULL,
    "calculation_type" varchar(50) DEFAULT 'PER_SQ_FT' NOT NULL,
    "per_sqft_rate" numeric(10, 2) DEFAULT '3.50' NOT NULL,
    "flat_rate_same_for_all" numeric(10, 2) DEFAULT '2500.00' NOT NULL,
    "per_flat_type_rates" text DEFAULT '{"1BHK":1500,"2BHK":2500,"3BHK":3500,"Shop":4000}' NOT NULL,
    "created_at" timestamp with time zone DEFAULT now() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
