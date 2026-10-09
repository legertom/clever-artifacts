ALTER TYPE "public"."artifact_visibility" ADD VALUE 'private' BEFORE 'domain';--> statement-breakpoint
ALTER TABLE "artifacts" ALTER COLUMN "visibility" SET DEFAULT 'private';