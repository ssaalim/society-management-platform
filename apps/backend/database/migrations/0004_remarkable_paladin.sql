CREATE TABLE IF NOT EXISTS "family_members" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"society_id" uuid NOT NULL,
	"member_id" uuid NOT NULL,
	"name" varchar(150) NOT NULL,
	"relation" varchar(50) NOT NULL,
	"mobile" varchar(15),
	"aadhaar" varchar(12),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "nominees" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"society_id" uuid NOT NULL,
	"member_id" uuid NOT NULL,
	"name" varchar(150) NOT NULL,
	"relation" varchar(50) NOT NULL,
	"mobile" varchar(15),
	"share_percentage" numeric(5, 2) DEFAULT '100.00' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "members" ADD COLUMN "member_type" varchar(50) DEFAULT 'OWNER' NOT NULL;--> statement-breakpoint
ALTER TABLE "members" ADD COLUMN "photo_url" text;--> statement-breakpoint
ALTER TABLE "members" ADD COLUMN "aadhaar_url" text;--> statement-breakpoint
ALTER TABLE "members" ADD COLUMN "pan_url" text;--> statement-breakpoint
ALTER TABLE "members" ADD COLUMN "agreement_url" text;--> statement-breakpoint
ALTER TABLE "members" ADD COLUMN "police_verification_url" text;--> statement-breakpoint
ALTER TABLE "members" ADD COLUMN "emergency_contact_name" varchar(150);--> statement-breakpoint
ALTER TABLE "members" ADD COLUMN "emergency_contact_phone" varchar(15);--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "family_members" ADD CONSTRAINT "family_members_society_id_societies_id_fk" FOREIGN KEY ("society_id") REFERENCES "public"."societies"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "family_members" ADD CONSTRAINT "family_members_member_id_members_id_fk" FOREIGN KEY ("member_id") REFERENCES "public"."members"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "nominees" ADD CONSTRAINT "nominees_society_id_societies_id_fk" FOREIGN KEY ("society_id") REFERENCES "public"."societies"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "nominees" ADD CONSTRAINT "nominees_member_id_members_id_fk" FOREIGN KEY ("member_id") REFERENCES "public"."members"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_family_members_society" ON "family_members" ("society_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_nominees_society" ON "nominees" ("society_id");