CREATE TYPE "public"."oauth_token_kind" AS ENUM('access', 'refresh', 'pat');--> statement-breakpoint
CREATE TABLE "artifact_aliases" (
	"slug" varchar(80) PRIMARY KEY NOT NULL,
	"artifact_id" varchar(21) NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "artifact_views" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"artifact_id" varchar(21) NOT NULL,
	"user_id" uuid NOT NULL,
	"viewed_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "oauth_clients" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"secret_hash" text,
	"redirect_uris" text[] NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "oauth_codes" (
	"code_hash" text PRIMARY KEY NOT NULL,
	"client_id" text NOT NULL,
	"user_id" uuid NOT NULL,
	"redirect_uri" text NOT NULL,
	"code_challenge" text NOT NULL,
	"scope" text NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "oauth_tokens" (
	"token_hash" text PRIMARY KEY NOT NULL,
	"kind" "oauth_token_kind" NOT NULL,
	"client_id" text,
	"user_id" uuid NOT NULL,
	"scope" text DEFAULT 'artifacts' NOT NULL,
	"name" text,
	"family_id" text,
	"expires_at" timestamp with time zone,
	"last_used_at" timestamp with time zone,
	"revoked_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "artifacts" ADD COLUMN "slug" varchar(80);--> statement-breakpoint
UPDATE "artifacts" a SET "slug" = sub.s FROM (
	SELECT "id", trim(both '-' from regexp_replace(lower("title"), '[^a-z0-9]+', '-', 'g')) AS s FROM "artifacts"
) sub WHERE a."id" = sub."id" AND sub.s <> '' AND length(sub.s) <= 72
	AND (SELECT count(*) FROM "artifacts" t WHERE trim(both '-' from regexp_replace(lower(t."title"), '[^a-z0-9]+', '-', 'g')) = sub.s) = 1;--> statement-breakpoint
UPDATE "artifacts" SET "slug" = "id" WHERE "slug" IS NULL;--> statement-breakpoint
ALTER TABLE "artifacts" ALTER COLUMN "slug" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "artifacts" ADD COLUMN "description" text;--> statement-breakpoint
ALTER TABLE "artifacts" ADD COLUMN "source_url" text;--> statement-breakpoint
ALTER TABLE "artifacts" ADD COLUMN "tags" text[] DEFAULT '{}'::text[] NOT NULL;--> statement-breakpoint
ALTER TABLE "artifacts" ADD COLUMN "view_count" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "artifacts" ADD COLUMN "last_viewed_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "artifacts" ADD COLUMN "trashed_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "artifacts" ADD COLUMN "trashed_by" uuid;--> statement-breakpoint
ALTER TABLE "artifact_aliases" ADD CONSTRAINT "artifact_aliases_artifact_id_artifacts_id_fk" FOREIGN KEY ("artifact_id") REFERENCES "public"."artifacts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "artifact_views" ADD CONSTRAINT "artifact_views_artifact_id_artifacts_id_fk" FOREIGN KEY ("artifact_id") REFERENCES "public"."artifacts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "artifact_views" ADD CONSTRAINT "artifact_views_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "oauth_codes" ADD CONSTRAINT "oauth_codes_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "oauth_tokens" ADD CONSTRAINT "oauth_tokens_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "artifact_aliases_artifact_idx" ON "artifact_aliases" USING btree ("artifact_id");--> statement-breakpoint
CREATE INDEX "artifact_views_artifact_idx" ON "artifact_views" USING btree ("artifact_id","viewed_at");--> statement-breakpoint
CREATE INDEX "artifact_views_user_idx" ON "artifact_views" USING btree ("user_id","viewed_at");--> statement-breakpoint
CREATE INDEX "oauth_tokens_user_idx" ON "oauth_tokens" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "oauth_tokens_family_idx" ON "oauth_tokens" USING btree ("family_id");--> statement-breakpoint
ALTER TABLE "artifacts" ADD CONSTRAINT "artifacts_trashed_by_users_id_fk" FOREIGN KEY ("trashed_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "artifacts_trashed_idx" ON "artifacts" USING btree ("trashed_at");--> statement-breakpoint
ALTER TABLE "artifacts" ADD CONSTRAINT "artifacts_slug_unique" UNIQUE("slug");