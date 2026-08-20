-- Custom SQL Report Builder Tables Migration
-- Migration: 0010_custom_reports.sql

CREATE TABLE IF NOT EXISTS "custom_reports" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "society_id" uuid NOT NULL REFERENCES "societies"("id") ON DELETE CASCADE,
  "name" varchar(255) NOT NULL,
  "description" text,
  "sql_query" text NOT NULL,
  "parameters" jsonb DEFAULT '[]'::jsonb NOT NULL,
  "is_active" boolean DEFAULT true NOT NULL,
  "created_by" uuid REFERENCES "users"("id") ON DELETE SET NULL,
  "updated_by" uuid REFERENCES "users"("id") ON DELETE SET NULL,
  "created_at" timestamptz DEFAULT now() NOT NULL,
  "updated_at" timestamptz DEFAULT now() NOT NULL,
  "deleted_at" timestamptz
);

CREATE INDEX IF NOT EXISTS "idx_custom_reports_society" ON "custom_reports" ("society_id");

CREATE TABLE IF NOT EXISTS "custom_report_favorites" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "report_id" uuid NOT NULL REFERENCES "custom_reports"("id") ON DELETE CASCADE,
  "user_id" uuid NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "society_id" uuid NOT NULL REFERENCES "societies"("id") ON DELETE CASCADE,
  "created_at" timestamptz DEFAULT now() NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS "idx_custom_report_fav_unique" ON "custom_report_favorites" ("report_id", "user_id");
CREATE INDEX IF NOT EXISTS "idx_custom_report_fav_user" ON "custom_report_favorites" ("user_id", "society_id");
