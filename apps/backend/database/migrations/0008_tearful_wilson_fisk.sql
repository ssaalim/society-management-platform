CREATE TABLE IF NOT EXISTS "asset_logs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"society_id" uuid NOT NULL,
	"asset_id" uuid NOT NULL,
	"type" varchar(50) NOT NULL,
	"description" text NOT NULL,
	"cost" numeric(12, 2) DEFAULT '0.00' NOT NULL,
	"date" date NOT NULL,
	"status" varchar(50) DEFAULT 'SCHEDULED' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "notification_logs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"society_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"channel" varchar(50) NOT NULL,
	"status" varchar(50) DEFAULT 'SENT' NOT NULL,
	"attempts" integer DEFAULT 1 NOT NULL,
	"error_message" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "notification_templates" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"society_id" uuid NOT NULL,
	"name" varchar(100) NOT NULL,
	"subject" varchar(255),
	"body" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "complaints" ADD COLUMN "escalation_level" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "complaints" ADD COLUMN "escalated_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "visitors" ADD COLUMN "status" varchar(50) DEFAULT 'PENDING' NOT NULL;--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "asset_logs" ADD CONSTRAINT "asset_logs_society_id_societies_id_fk" FOREIGN KEY ("society_id") REFERENCES "public"."societies"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "asset_logs" ADD CONSTRAINT "asset_logs_asset_id_assets_id_fk" FOREIGN KEY ("asset_id") REFERENCES "public"."assets"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "notification_logs" ADD CONSTRAINT "notification_logs_society_id_societies_id_fk" FOREIGN KEY ("society_id") REFERENCES "public"."societies"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "notification_logs" ADD CONSTRAINT "notification_logs_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "notification_templates" ADD CONSTRAINT "notification_templates_society_id_societies_id_fk" FOREIGN KEY ("society_id") REFERENCES "public"."societies"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
