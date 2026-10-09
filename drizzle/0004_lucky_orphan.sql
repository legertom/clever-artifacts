ALTER TABLE "artifacts" ADD COLUMN "share_with_reports" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "manager_email" text;