-- v0.6: Inspirations become Reference Pictures, multiple admins, portfolio, booking.
-- Hand-written so existing data is renamed, not dropped.
ALTER TABLE "inspirations" RENAME TO "reference_pictures";--> statement-breakpoint
ALTER TABLE "reference_pictures" RENAME CONSTRAINT "inspirations_page_id_photo_id_unique" TO "reference_pictures_page_id_photo_id_unique";--> statement-breakpoint
ALTER TABLE "reference_pictures" RENAME CONSTRAINT "inspirations_page_id_client_pages_id_fk" TO "reference_pictures_page_id_client_pages_id_fk";--> statement-breakpoint
ALTER TABLE "reference_pictures" DROP CONSTRAINT "inspirations_photo_id_photos_id_fk";--> statement-breakpoint
ALTER TABLE "reference_pictures" ALTER COLUMN "photo_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "reference_pictures" ADD CONSTRAINT "reference_pictures_photo_id_photos_id_fk" FOREIGN KEY ("photo_id") REFERENCES "public"."photos"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reference_pictures" ADD COLUMN "hidden_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "reference_pictures" ADD COLUMN "accepted_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "reference_pictures" ADD COLUMN "snapshot_filename" text;--> statement-breakpoint
ALTER TABLE "reference_pictures" ADD COLUMN "snapshot_title" text;--> statement-breakpoint
ALTER TABLE "reference_pictures" ADD COLUMN "snapshot_tags" text[];--> statement-breakpoint
CREATE INDEX "reference_pictures_photo_id_index" ON "reference_pictures" USING btree ("photo_id");--> statement-breakpoint
UPDATE "reference_pictures" SET "accepted_at" = "created_at" WHERE "state" = 'accepted';--> statement-breakpoint
ALTER TABLE "comments" RENAME COLUMN "inspiration_id" TO "reference_picture_id";--> statement-breakpoint
ALTER TABLE "comments" RENAME CONSTRAINT "comments_inspiration_id_inspirations_id_fk" TO "comments_reference_picture_id_reference_pictures_id_fk";--> statement-breakpoint
ALTER INDEX "comments_inspiration_id_index" RENAME TO "comments_reference_picture_id_index";--> statement-breakpoint
CREATE TABLE "activity_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"page_id" uuid NOT NULL,
	"kind" text NOT NULL,
	"digested_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);--> statement-breakpoint
CREATE TABLE "admin_invites" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"email" text NOT NULL,
	"invited_by" uuid,
	"status" text NOT NULL,
	"decided_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);--> statement-breakpoint
CREATE TABLE "availability_rules" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"admin_id" uuid NOT NULL,
	"weekday" integer NOT NULL,
	"start_time" text NOT NULL,
	"end_time" text NOT NULL
);--> statement-breakpoint
CREATE TABLE "bookings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"client_id" uuid NOT NULL,
	"admin_id" uuid NOT NULL,
	"session_type_id" uuid,
	"session_name" text NOT NULL,
	"starts_at" timestamp with time zone NOT NULL,
	"ends_at" timestamp with time zone NOT NULL,
	"status" text DEFAULT 'confirmed' NOT NULL,
	"page_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);--> statement-breakpoint
CREATE TABLE "client_admins" (
	"client_id" uuid NOT NULL,
	"admin_id" uuid NOT NULL,
	CONSTRAINT "client_admins_client_id_admin_id_pk" PRIMARY KEY("client_id","admin_id")
);--> statement-breakpoint
CREATE TABLE "contact_messages" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"email" text NOT NULL,
	"body" text NOT NULL,
	"ip_hash" text NOT NULL,
	"handled_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);--> statement-breakpoint
CREATE TABLE "session_types" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"duration_minutes" integer NOT NULL,
	"description" text DEFAULT '' NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL
);--> statement-breakpoint
CREATE TABLE "shoot_photo_tags" (
	"shoot_photo_id" uuid NOT NULL,
	"tag_id" integer NOT NULL,
	CONSTRAINT "shoot_photo_tags_shoot_photo_id_tag_id_pk" PRIMARY KEY("shoot_photo_id","tag_id")
);--> statement-breakpoint
CREATE TABLE "studio_settings" (
	"id" integer PRIMARY KEY DEFAULT 1 NOT NULL,
	"time_zone" text DEFAULT 'America/Los_Angeles' NOT NULL,
	"buffer_minutes" integer DEFAULT 30 NOT NULL,
	"cancel_cutoff_hours" integer DEFAULT 48 NOT NULL,
	"digest_delay_minutes" integer DEFAULT 30 NOT NULL
);--> statement-breakpoint
CREATE TABLE "team_profiles" (
	"user_id" uuid PRIMARY KEY NOT NULL,
	"display_name" text NOT NULL,
	"role_title" text DEFAULT '' NOT NULL,
	"bio" text DEFAULT '' NOT NULL,
	"years_experience" integer,
	"specialties" text DEFAULT '' NOT NULL,
	"photo_key" text,
	"visible" boolean DEFAULT false NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL
);--> statement-breakpoint
CREATE TABLE "time_off" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"admin_id" uuid NOT NULL,
	"start_date" date NOT NULL,
	"end_date" date NOT NULL,
	"note" text DEFAULT '' NOT NULL
);--> statement-breakpoint
ALTER TABLE "activity_events" ADD CONSTRAINT "activity_events_page_id_client_pages_id_fk" FOREIGN KEY ("page_id") REFERENCES "public"."client_pages"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "admin_invites" ADD CONSTRAINT "admin_invites_invited_by_users_id_fk" FOREIGN KEY ("invited_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "availability_rules" ADD CONSTRAINT "availability_rules_admin_id_users_id_fk" FOREIGN KEY ("admin_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_client_id_clients_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_admin_id_users_id_fk" FOREIGN KEY ("admin_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_session_type_id_session_types_id_fk" FOREIGN KEY ("session_type_id") REFERENCES "public"."session_types"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_page_id_client_pages_id_fk" FOREIGN KEY ("page_id") REFERENCES "public"."client_pages"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "client_admins" ADD CONSTRAINT "client_admins_client_id_clients_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "client_admins" ADD CONSTRAINT "client_admins_admin_id_users_id_fk" FOREIGN KEY ("admin_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "shoot_photo_tags" ADD CONSTRAINT "shoot_photo_tags_shoot_photo_id_shoot_photos_id_fk" FOREIGN KEY ("shoot_photo_id") REFERENCES "public"."shoot_photos"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "shoot_photo_tags" ADD CONSTRAINT "shoot_photo_tags_tag_id_tags_id_fk" FOREIGN KEY ("tag_id") REFERENCES "public"."tags"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "team_profiles" ADD CONSTRAINT "team_profiles_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "time_off" ADD CONSTRAINT "time_off_admin_id_users_id_fk" FOREIGN KEY ("admin_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "activity_events_page_id_index" ON "activity_events" USING btree ("page_id");--> statement-breakpoint
CREATE INDEX "availability_rules_admin_id_index" ON "availability_rules" USING btree ("admin_id");--> statement-breakpoint
CREATE INDEX "bookings_admin_id_starts_at_index" ON "bookings" USING btree ("admin_id","starts_at");--> statement-breakpoint
CREATE INDEX "bookings_client_id_index" ON "bookings" USING btree ("client_id");--> statement-breakpoint
CREATE INDEX "client_admins_admin_id_index" ON "client_admins" USING btree ("admin_id");--> statement-breakpoint
CREATE INDEX "shoot_photo_tags_tag_id_index" ON "shoot_photo_tags" USING btree ("tag_id");--> statement-breakpoint
CREATE INDEX "time_off_admin_id_index" ON "time_off" USING btree ("admin_id");--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "is_super_admin" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "email_prefs" jsonb DEFAULT '{"messages":true,"activity":true,"bookings":true}'::jsonb NOT NULL;--> statement-breakpoint
UPDATE "users" SET "is_super_admin" = true WHERE "id" = (SELECT "id" FROM "users" WHERE "role" = 'admin' ORDER BY "created_at" LIMIT 1);--> statement-breakpoint
ALTER TABLE "clients" ADD COLUMN "username" text;--> statement-breakpoint
ALTER TABLE "clients" ADD CONSTRAINT "clients_username_unique" UNIQUE("username");--> statement-breakpoint
INSERT INTO "client_admins" ("client_id", "admin_id") SELECT c."id", u."id" FROM "clients" c CROSS JOIN "users" u WHERE u."is_super_admin";--> statement-breakpoint
ALTER TABLE "account_tokens" ADD COLUMN "admin_invite_id" uuid;--> statement-breakpoint
ALTER TABLE "account_tokens" ADD CONSTRAINT "account_tokens_admin_invite_id_admin_invites_id_fk" FOREIGN KEY ("admin_invite_id") REFERENCES "public"."admin_invites"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "photos" ADD COLUMN "source_url" text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE "photos" ADD COLUMN "credit" text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE "photos" ADD COLUMN "in_portfolio" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "photos" ADD COLUMN "focus_x" integer DEFAULT 50 NOT NULL;--> statement-breakpoint
ALTER TABLE "photos" ADD COLUMN "focus_y" integer DEFAULT 50 NOT NULL;--> statement-breakpoint
ALTER TABLE "client_pages" ADD COLUMN "locked_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "client_pages" ADD COLUMN "favourites_limit" integer;--> statement-breakpoint
ALTER TABLE "client_pages" ADD COLUMN "admin_seen_at" timestamp with time zone;--> statement-breakpoint
UPDATE "client_pages" SET "locked_at" = now() WHERE "shoot_photos_visible";--> statement-breakpoint
ALTER TABLE "shoot_photos" ADD COLUMN "clean_key" text;--> statement-breakpoint
ALTER TABLE "shoot_photos" ADD COLUMN "favourite" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "shoot_photos" ADD COLUMN "in_portfolio" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "shoot_photos" ADD COLUMN "focus_x" integer DEFAULT 50 NOT NULL;--> statement-breakpoint
ALTER TABLE "shoot_photos" ADD COLUMN "focus_y" integer DEFAULT 50 NOT NULL;--> statement-breakpoint
ALTER TABLE "comments" ADD COLUMN "author_user_id" uuid;--> statement-breakpoint
ALTER TABLE "comments" ADD CONSTRAINT "comments_author_user_id_users_id_fk" FOREIGN KEY ("author_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "messages" ADD COLUMN "sender_user_id" uuid;--> statement-breakpoint
ALTER TABLE "messages" ADD CONSTRAINT "messages_sender_user_id_users_id_fk" FOREIGN KEY ("sender_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
INSERT INTO "studio_settings" ("id") VALUES (1);--> statement-breakpoint
INSERT INTO "team_profiles" ("user_id", "display_name") SELECT "id", "name" FROM "users" WHERE "role" = 'admin';
