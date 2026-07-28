ALTER TABLE "flat_tenants" ADD COLUMN "rental_agreement_url" text;--> statement-breakpoint
ALTER TABLE "flat_tenants" ADD COLUMN "police_verification_url" text;--> statement-breakpoint
ALTER TABLE "flat_tenants" ADD COLUMN "tenant_noc_url" text;--> statement-breakpoint
ALTER TABLE "flat_tenants" ADD COLUMN "emergency_contact_name" varchar(150);--> statement-breakpoint
ALTER TABLE "flat_tenants" ADD COLUMN "emergency_contact_phone" varchar(15);--> statement-breakpoint
ALTER TABLE "flat_tenants" ADD COLUMN "move_in_date" date;--> statement-breakpoint
ALTER TABLE "flat_tenants" ADD COLUMN "move_out_date" date;--> statement-breakpoint
ALTER TABLE "flats" ADD COLUMN "carpet_area" numeric(10, 2);--> statement-breakpoint
ALTER TABLE "flats" ADD COLUMN "terrace_area" numeric(10, 2);