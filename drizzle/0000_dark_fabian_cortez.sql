CREATE TYPE "public"."artifact_visibility" AS ENUM('domain', 'restricted');--> statement-breakpoint
CREATE TYPE "public"."screenshot_status" AS ENUM('pending', 'ready', 'failed');--> statement-breakpoint
CREATE TABLE "artifact_shares" (
	"artifact_id" varchar(21) NOT NULL,
	"email" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "artifact_shares_artifact_id_email_pk" PRIMARY KEY("artifact_id","email")
);
--> statement-breakpoint
CREATE TABLE "artifacts" (
	"id" varchar(21) PRIMARY KEY NOT NULL,
	"owner_id" uuid NOT NULL,
	"title" text NOT NULL,
	"visibility" "artifact_visibility" DEFAULT 'domain' NOT NULL,
	"html" text NOT NULL,
	"html_bytes" integer NOT NULL,
	"screenshot" text,
	"screenshot_status" "screenshot_status" DEFAULT 'pending' NOT NULL,
	"screenshot_error" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"email" text NOT NULL,
	"name" text,
	"image" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"last_login_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "users_email_unique" UNIQUE("email")
);
--> statement-breakpoint
ALTER TABLE "artifact_shares" ADD CONSTRAINT "artifact_shares_artifact_id_artifacts_id_fk" FOREIGN KEY ("artifact_id") REFERENCES "public"."artifacts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "artifacts" ADD CONSTRAINT "artifacts_owner_id_users_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "artifact_shares_email_idx" ON "artifact_shares" USING btree ("email");--> statement-breakpoint
CREATE INDEX "artifacts_owner_idx" ON "artifacts" USING btree ("owner_id");--> statement-breakpoint
CREATE INDEX "artifacts_updated_idx" ON "artifacts" USING btree ("updated_at");