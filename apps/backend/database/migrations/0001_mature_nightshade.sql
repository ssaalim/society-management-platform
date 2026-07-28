CREATE TABLE IF NOT EXISTS "assets" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"society_id" uuid NOT NULL,
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
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "bank_accounts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"society_id" uuid NOT NULL,
	"ledger_id" uuid NOT NULL,
	"bank_name" varchar(150) NOT NULL,
	"account_number" varchar(50) NOT NULL,
	"ifsc" varchar(11) NOT NULL,
	"branch_name" varchar(150),
	"type" varchar(50) DEFAULT 'SAVINGS' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "bill_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"society_id" uuid NOT NULL,
	"bill_id" uuid NOT NULL,
	"head_id" uuid NOT NULL,
	"amount" numeric(12, 2) NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "buildings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"society_id" uuid NOT NULL,
	"name" varchar(100) NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "complaints" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"society_id" uuid NOT NULL,
	"flat_id" uuid NOT NULL,
	"raised_by_user_id" uuid NOT NULL,
	"assigned_staff_id" uuid,
	"title" varchar(255) NOT NULL,
	"description" text NOT NULL,
	"status" varchar(50) DEFAULT 'OPEN' NOT NULL,
	"priority" varchar(20) DEFAULT 'MEDIUM' NOT NULL,
	"resident_feedback" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "documents" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"society_id" uuid NOT NULL,
	"name" varchar(255) NOT NULL,
	"file_url" text NOT NULL,
	"file_size" integer,
	"category" varchar(100) NOT NULL,
	"is_private" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "expenses" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"society_id" uuid NOT NULL,
	"voucher_id" uuid,
	"vendor_id" uuid,
	"bill_number" varchar(100),
	"amount" numeric(12, 2) NOT NULL,
	"date" date NOT NULL,
	"status" varchar(50) DEFAULT 'UNPAID' NOT NULL,
	"approval_status" varchar(50) DEFAULT 'APPROVED' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "flat_owners" (
	"flat_id" uuid NOT NULL,
	"owner_id" uuid NOT NULL,
	"is_primary" boolean DEFAULT true NOT NULL,
	"ownership_share" numeric(5, 2),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "flat_owners_flat_id_owner_id_pk" PRIMARY KEY("flat_id","owner_id")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "flat_tenants" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"society_id" uuid NOT NULL,
	"flat_id" uuid NOT NULL,
	"tenant_id" uuid NOT NULL,
	"lease_start" date NOT NULL,
	"lease_end" date NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "flats" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"society_id" uuid NOT NULL,
	"floor_id" uuid NOT NULL,
	"number" varchar(50) NOT NULL,
	"sqft_area" numeric(10, 2) NOT NULL,
	"flat_type" varchar(50) NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "floors" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"society_id" uuid NOT NULL,
	"wing_id" uuid NOT NULL,
	"number" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "ledgers" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"society_id" uuid NOT NULL,
	"name" varchar(255) NOT NULL,
	"group" varchar(100) NOT NULL,
	"code" varchar(50),
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "maintenance_bills" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"society_id" uuid NOT NULL,
	"flat_id" uuid NOT NULL,
	"bill_number" varchar(50) NOT NULL,
	"billing_period_start" date NOT NULL,
	"billing_period_end" date NOT NULL,
	"due_date" date NOT NULL,
	"total_amount" numeric(12, 2) NOT NULL,
	"status" varchar(50) DEFAULT 'UNPAID' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "maintenance_heads" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"society_id" uuid NOT NULL,
	"ledger_id" uuid NOT NULL,
	"name" varchar(150) NOT NULL,
	"description" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "maintenance_rates" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"society_id" uuid NOT NULL,
	"head_id" uuid NOT NULL,
	"flat_type" varchar(50) NOT NULL,
	"calculation_type" varchar(50) NOT NULL,
	"rate" numeric(12, 2) NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "meeting_minutes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"society_id" uuid NOT NULL,
	"meeting_id" uuid NOT NULL,
	"minutes_content" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "meeting_minutes_meeting_id_unique" UNIQUE("meeting_id")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "meetings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"society_id" uuid NOT NULL,
	"title" varchar(255) NOT NULL,
	"description" text,
	"scheduled_at" timestamp with time zone NOT NULL,
	"location" varchar(255) NOT NULL,
	"type" varchar(50) DEFAULT 'COMMITTEE' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "members" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"society_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"membership_number" varchar(50) NOT NULL,
	"status" varchar(50) DEFAULT 'ACTIVE' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "notices" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"society_id" uuid NOT NULL,
	"title" varchar(255) NOT NULL,
	"content" text NOT NULL,
	"type" varchar(50) DEFAULT 'GENERAL' NOT NULL,
	"expires_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "notifications" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"society_id" uuid NOT NULL,
	"recipient_user_id" uuid,
	"recipient_contact" varchar(255) NOT NULL,
	"channel" varchar(20) NOT NULL,
	"title" varchar(255),
	"body" text NOT NULL,
	"status" varchar(20) DEFAULT 'PENDING' NOT NULL,
	"error_details" text,
	"sent_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "owners" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"society_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"pan" varchar(10),
	"aadhaar" varchar(12),
	"emergency_contact" varchar(100),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "parking_slots" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"society_id" uuid NOT NULL,
	"flat_id" uuid,
	"slot_number" varchar(50) NOT NULL,
	"type" varchar(50) DEFAULT 'OPEN' NOT NULL,
	"charges" numeric(8, 2) DEFAULT '0.00' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "receipts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"society_id" uuid NOT NULL,
	"bill_id" uuid NOT NULL,
	"receipt_number" varchar(50) NOT NULL,
	"amount_paid" numeric(12, 2) NOT NULL,
	"payment_mode" varchar(50) NOT NULL,
	"payment_date" date NOT NULL,
	"reference_number" varchar(100),
	"cheque_status" varchar(50),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "settings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"society_id" uuid NOT NULL,
	"financial_year_start" date DEFAULT '2026-04-01' NOT NULL,
	"billing_frequency" varchar(50) DEFAULT 'MONTHLY' NOT NULL,
	"penalty_interest_rate" numeric(5, 2) DEFAULT '12.00' NOT NULL,
	"invoice_due_days" integer DEFAULT 15 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "settings_society_id_unique" UNIQUE("society_id")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "staff" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"society_id" uuid NOT NULL,
	"name" varchar(150) NOT NULL,
	"mobile" varchar(15) NOT NULL,
	"role" varchar(100) NOT NULL,
	"salary" numeric(10, 2) DEFAULT '0.00',
	"is_available" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "staff_attendance" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"society_id" uuid NOT NULL,
	"staff_id" uuid NOT NULL,
	"date" date NOT NULL,
	"check_in" timestamp with time zone,
	"check_out" timestamp with time zone,
	"status" varchar(20) DEFAULT 'PRESENT' NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "staff_leaves" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"society_id" uuid NOT NULL,
	"staff_id" uuid NOT NULL,
	"start_date" date NOT NULL,
	"end_date" date NOT NULL,
	"reason" text,
	"status" varchar(50) DEFAULT 'PENDING' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "staff_salaries" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"society_id" uuid NOT NULL,
	"staff_id" uuid NOT NULL,
	"month" integer NOT NULL,
	"year" integer NOT NULL,
	"base_amount" numeric(10, 2) NOT NULL,
	"bonus" numeric(10, 2) DEFAULT '0.00',
	"deductions" numeric(10, 2) DEFAULT '0.00',
	"paid_at" timestamp with time zone,
	"payment_mode" varchar(50),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "tenants" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"society_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"police_verified" boolean DEFAULT false NOT NULL,
	"police_verification_date" date,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "transactions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"society_id" uuid NOT NULL,
	"voucher_id" uuid NOT NULL,
	"ledger_id" uuid NOT NULL,
	"type" varchar(10) NOT NULL,
	"amount" numeric(12, 2) NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "vehicles" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"society_id" uuid NOT NULL,
	"flat_id" uuid NOT NULL,
	"parking_slot_id" uuid,
	"number" varchar(50) NOT NULL,
	"type" varchar(20) DEFAULT 'FOUR_WHEELER' NOT NULL,
	"make" varchar(100),
	"model" varchar(100),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "vendors" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"society_id" uuid NOT NULL,
	"name" varchar(255) NOT NULL,
	"contact_person" varchar(150),
	"email" varchar(255),
	"mobile" varchar(15),
	"gstin" varchar(15),
	"pan" varchar(10),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "visitors" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"society_id" uuid NOT NULL,
	"flat_id" uuid NOT NULL,
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
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "vouchers" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"society_id" uuid NOT NULL,
	"voucher_number" varchar(50) NOT NULL,
	"type" varchar(50) NOT NULL,
	"date" date NOT NULL,
	"narration" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "wings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"society_id" uuid NOT NULL,
	"building_id" uuid NOT NULL,
	"name" varchar(50) NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "societies" ADD COLUMN "address" text;--> statement-breakpoint
ALTER TABLE "societies" ADD COLUMN "gstin" varchar(15);--> statement-breakpoint
ALTER TABLE "societies" ADD COLUMN "pan" varchar(10);--> statement-breakpoint
ALTER TABLE "societies" ADD COLUMN "tan" varchar(10);--> statement-breakpoint
ALTER TABLE "societies" ADD COLUMN "registration_number" varchar(100);--> statement-breakpoint
ALTER TABLE "societies" ADD COLUMN "is_active" boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "mobile" varchar(15);--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "avatar_url" text;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "is_active" boolean DEFAULT true NOT NULL;--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "assets" ADD CONSTRAINT "assets_society_id_societies_id_fk" FOREIGN KEY ("society_id") REFERENCES "public"."societies"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "bank_accounts" ADD CONSTRAINT "bank_accounts_society_id_societies_id_fk" FOREIGN KEY ("society_id") REFERENCES "public"."societies"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "bank_accounts" ADD CONSTRAINT "bank_accounts_ledger_id_ledgers_id_fk" FOREIGN KEY ("ledger_id") REFERENCES "public"."ledgers"("id") ON DELETE restrict ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "bill_items" ADD CONSTRAINT "bill_items_society_id_societies_id_fk" FOREIGN KEY ("society_id") REFERENCES "public"."societies"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "bill_items" ADD CONSTRAINT "bill_items_bill_id_maintenance_bills_id_fk" FOREIGN KEY ("bill_id") REFERENCES "public"."maintenance_bills"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "bill_items" ADD CONSTRAINT "bill_items_head_id_maintenance_heads_id_fk" FOREIGN KEY ("head_id") REFERENCES "public"."maintenance_heads"("id") ON DELETE restrict ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "buildings" ADD CONSTRAINT "buildings_society_id_societies_id_fk" FOREIGN KEY ("society_id") REFERENCES "public"."societies"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "complaints" ADD CONSTRAINT "complaints_society_id_societies_id_fk" FOREIGN KEY ("society_id") REFERENCES "public"."societies"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "complaints" ADD CONSTRAINT "complaints_flat_id_flats_id_fk" FOREIGN KEY ("flat_id") REFERENCES "public"."flats"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "complaints" ADD CONSTRAINT "complaints_raised_by_user_id_users_id_fk" FOREIGN KEY ("raised_by_user_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "complaints" ADD CONSTRAINT "complaints_assigned_staff_id_staff_id_fk" FOREIGN KEY ("assigned_staff_id") REFERENCES "public"."staff"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "documents" ADD CONSTRAINT "documents_society_id_societies_id_fk" FOREIGN KEY ("society_id") REFERENCES "public"."societies"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "expenses" ADD CONSTRAINT "expenses_society_id_societies_id_fk" FOREIGN KEY ("society_id") REFERENCES "public"."societies"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "expenses" ADD CONSTRAINT "expenses_voucher_id_vouchers_id_fk" FOREIGN KEY ("voucher_id") REFERENCES "public"."vouchers"("id") ON DELETE restrict ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "expenses" ADD CONSTRAINT "expenses_vendor_id_vendors_id_fk" FOREIGN KEY ("vendor_id") REFERENCES "public"."vendors"("id") ON DELETE restrict ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "flat_owners" ADD CONSTRAINT "flat_owners_flat_id_flats_id_fk" FOREIGN KEY ("flat_id") REFERENCES "public"."flats"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "flat_owners" ADD CONSTRAINT "flat_owners_owner_id_owners_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."owners"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "flat_tenants" ADD CONSTRAINT "flat_tenants_society_id_societies_id_fk" FOREIGN KEY ("society_id") REFERENCES "public"."societies"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "flat_tenants" ADD CONSTRAINT "flat_tenants_flat_id_flats_id_fk" FOREIGN KEY ("flat_id") REFERENCES "public"."flats"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "flat_tenants" ADD CONSTRAINT "flat_tenants_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "flats" ADD CONSTRAINT "flats_society_id_societies_id_fk" FOREIGN KEY ("society_id") REFERENCES "public"."societies"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "flats" ADD CONSTRAINT "flats_floor_id_floors_id_fk" FOREIGN KEY ("floor_id") REFERENCES "public"."floors"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "floors" ADD CONSTRAINT "floors_society_id_societies_id_fk" FOREIGN KEY ("society_id") REFERENCES "public"."societies"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "floors" ADD CONSTRAINT "floors_wing_id_wings_id_fk" FOREIGN KEY ("wing_id") REFERENCES "public"."wings"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "ledgers" ADD CONSTRAINT "ledgers_society_id_societies_id_fk" FOREIGN KEY ("society_id") REFERENCES "public"."societies"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "maintenance_bills" ADD CONSTRAINT "maintenance_bills_society_id_societies_id_fk" FOREIGN KEY ("society_id") REFERENCES "public"."societies"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "maintenance_bills" ADD CONSTRAINT "maintenance_bills_flat_id_flats_id_fk" FOREIGN KEY ("flat_id") REFERENCES "public"."flats"("id") ON DELETE restrict ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "maintenance_heads" ADD CONSTRAINT "maintenance_heads_society_id_societies_id_fk" FOREIGN KEY ("society_id") REFERENCES "public"."societies"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "maintenance_heads" ADD CONSTRAINT "maintenance_heads_ledger_id_ledgers_id_fk" FOREIGN KEY ("ledger_id") REFERENCES "public"."ledgers"("id") ON DELETE restrict ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "maintenance_rates" ADD CONSTRAINT "maintenance_rates_society_id_societies_id_fk" FOREIGN KEY ("society_id") REFERENCES "public"."societies"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "maintenance_rates" ADD CONSTRAINT "maintenance_rates_head_id_maintenance_heads_id_fk" FOREIGN KEY ("head_id") REFERENCES "public"."maintenance_heads"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "meeting_minutes" ADD CONSTRAINT "meeting_minutes_society_id_societies_id_fk" FOREIGN KEY ("society_id") REFERENCES "public"."societies"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "meeting_minutes" ADD CONSTRAINT "meeting_minutes_meeting_id_meetings_id_fk" FOREIGN KEY ("meeting_id") REFERENCES "public"."meetings"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "meetings" ADD CONSTRAINT "meetings_society_id_societies_id_fk" FOREIGN KEY ("society_id") REFERENCES "public"."societies"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "members" ADD CONSTRAINT "members_society_id_societies_id_fk" FOREIGN KEY ("society_id") REFERENCES "public"."societies"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "members" ADD CONSTRAINT "members_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "notices" ADD CONSTRAINT "notices_society_id_societies_id_fk" FOREIGN KEY ("society_id") REFERENCES "public"."societies"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "notifications" ADD CONSTRAINT "notifications_society_id_societies_id_fk" FOREIGN KEY ("society_id") REFERENCES "public"."societies"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "notifications" ADD CONSTRAINT "notifications_recipient_user_id_users_id_fk" FOREIGN KEY ("recipient_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "owners" ADD CONSTRAINT "owners_society_id_societies_id_fk" FOREIGN KEY ("society_id") REFERENCES "public"."societies"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "owners" ADD CONSTRAINT "owners_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "parking_slots" ADD CONSTRAINT "parking_slots_society_id_societies_id_fk" FOREIGN KEY ("society_id") REFERENCES "public"."societies"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "parking_slots" ADD CONSTRAINT "parking_slots_flat_id_flats_id_fk" FOREIGN KEY ("flat_id") REFERENCES "public"."flats"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "receipts" ADD CONSTRAINT "receipts_society_id_societies_id_fk" FOREIGN KEY ("society_id") REFERENCES "public"."societies"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "receipts" ADD CONSTRAINT "receipts_bill_id_maintenance_bills_id_fk" FOREIGN KEY ("bill_id") REFERENCES "public"."maintenance_bills"("id") ON DELETE restrict ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "settings" ADD CONSTRAINT "settings_society_id_societies_id_fk" FOREIGN KEY ("society_id") REFERENCES "public"."societies"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "staff" ADD CONSTRAINT "staff_society_id_societies_id_fk" FOREIGN KEY ("society_id") REFERENCES "public"."societies"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "staff_attendance" ADD CONSTRAINT "staff_attendance_society_id_societies_id_fk" FOREIGN KEY ("society_id") REFERENCES "public"."societies"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "staff_attendance" ADD CONSTRAINT "staff_attendance_staff_id_staff_id_fk" FOREIGN KEY ("staff_id") REFERENCES "public"."staff"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "staff_leaves" ADD CONSTRAINT "staff_leaves_society_id_societies_id_fk" FOREIGN KEY ("society_id") REFERENCES "public"."societies"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "staff_leaves" ADD CONSTRAINT "staff_leaves_staff_id_staff_id_fk" FOREIGN KEY ("staff_id") REFERENCES "public"."staff"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "staff_salaries" ADD CONSTRAINT "staff_salaries_society_id_societies_id_fk" FOREIGN KEY ("society_id") REFERENCES "public"."societies"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "staff_salaries" ADD CONSTRAINT "staff_salaries_staff_id_staff_id_fk" FOREIGN KEY ("staff_id") REFERENCES "public"."staff"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "tenants" ADD CONSTRAINT "tenants_society_id_societies_id_fk" FOREIGN KEY ("society_id") REFERENCES "public"."societies"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "tenants" ADD CONSTRAINT "tenants_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "transactions" ADD CONSTRAINT "transactions_society_id_societies_id_fk" FOREIGN KEY ("society_id") REFERENCES "public"."societies"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "transactions" ADD CONSTRAINT "transactions_voucher_id_vouchers_id_fk" FOREIGN KEY ("voucher_id") REFERENCES "public"."vouchers"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "transactions" ADD CONSTRAINT "transactions_ledger_id_ledgers_id_fk" FOREIGN KEY ("ledger_id") REFERENCES "public"."ledgers"("id") ON DELETE restrict ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "vehicles" ADD CONSTRAINT "vehicles_society_id_societies_id_fk" FOREIGN KEY ("society_id") REFERENCES "public"."societies"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "vehicles" ADD CONSTRAINT "vehicles_flat_id_flats_id_fk" FOREIGN KEY ("flat_id") REFERENCES "public"."flats"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "vehicles" ADD CONSTRAINT "vehicles_parking_slot_id_parking_slots_id_fk" FOREIGN KEY ("parking_slot_id") REFERENCES "public"."parking_slots"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "vendors" ADD CONSTRAINT "vendors_society_id_societies_id_fk" FOREIGN KEY ("society_id") REFERENCES "public"."societies"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "visitors" ADD CONSTRAINT "visitors_society_id_societies_id_fk" FOREIGN KEY ("society_id") REFERENCES "public"."societies"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "visitors" ADD CONSTRAINT "visitors_flat_id_flats_id_fk" FOREIGN KEY ("flat_id") REFERENCES "public"."flats"("id") ON DELETE restrict ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "vouchers" ADD CONSTRAINT "vouchers_society_id_societies_id_fk" FOREIGN KEY ("society_id") REFERENCES "public"."societies"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "wings" ADD CONSTRAINT "wings_society_id_societies_id_fk" FOREIGN KEY ("society_id") REFERENCES "public"."societies"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "wings" ADD CONSTRAINT "wings_building_id_buildings_id_fk" FOREIGN KEY ("building_id") REFERENCES "public"."buildings"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_assets_society" ON "assets" ("society_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_bank_accounts_society" ON "bank_accounts" ("society_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_bill_items_society" ON "bill_items" ("society_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_buildings_society" ON "buildings" ("society_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_complaints_society" ON "complaints" ("society_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_documents_society" ON "documents" ("society_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_expenses_society" ON "expenses" ("society_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_flat_tenants_society" ON "flat_tenants" ("society_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_flats_society" ON "flats" ("society_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_floors_society" ON "floors" ("society_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_ledgers_society" ON "ledgers" ("society_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_m_bills_society" ON "maintenance_bills" ("society_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_m_heads_society" ON "maintenance_heads" ("society_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_m_rates_society" ON "maintenance_rates" ("society_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_meetings_society" ON "meetings" ("society_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_members_society" ON "members" ("society_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "uq_membership_society" ON "members" ("society_id","membership_number");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_notices_society" ON "notices" ("society_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_notifications_society" ON "notifications" ("society_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_owners_society" ON "owners" ("society_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_parking_slots_society" ON "parking_slots" ("society_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_receipts_society" ON "receipts" ("society_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_staff_society" ON "staff" ("society_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_staff_attendance_society" ON "staff_attendance" ("society_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_staff_leaves_society" ON "staff_leaves" ("society_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_staff_salaries_society" ON "staff_salaries" ("society_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_tenants_society" ON "tenants" ("society_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_transactions_society" ON "transactions" ("society_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_vehicles_society" ON "vehicles" ("society_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_vendors_society" ON "vendors" ("society_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_visitors_society" ON "visitors" ("society_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_vouchers_society" ON "vouchers" ("society_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_wings_society" ON "wings" ("society_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_audit_logs_society" ON "audit_logs" ("society_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_societies_slug" ON "societies" ("slug");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_user_societies_search" ON "user_societies" ("user_id","society_id");