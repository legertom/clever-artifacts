CREATE TABLE "artifact_favorites" (
	"user_id" uuid NOT NULL,
	"artifact_id" varchar(21) NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "artifact_favorites_user_id_artifact_id_pk" PRIMARY KEY("user_id","artifact_id")
);
--> statement-breakpoint
ALTER TABLE "artifact_favorites" ADD CONSTRAINT "artifact_favorites_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "artifact_favorites" ADD CONSTRAINT "artifact_favorites_artifact_id_artifacts_id_fk" FOREIGN KEY ("artifact_id") REFERENCES "public"."artifacts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "artifact_favorites_artifact_idx" ON "artifact_favorites" USING btree ("artifact_id");