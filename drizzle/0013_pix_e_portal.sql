ALTER TABLE "orders" ADD COLUMN "pix_confirmed_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "pix_confirmed_by" uuid;--> statement-breakpoint
ALTER TABLE "tenants" ADD COLUMN "pix_key" text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE "tenants" ADD COLUMN "pix_name" text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE "tenants" ADD COLUMN "pix_city" text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE "tenants" ADD COLUMN "slug" text;--> statement-breakpoint
UPDATE "tenants" SET "slug" = trim(both '-' from left(regexp_replace(lower("name"), '[^a-z0-9]+', '-', 'g'), 30)) || '-' || left(md5(random()::text), 6);--> statement-breakpoint
ALTER TABLE "tenants" ALTER COLUMN "slug" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "tenants" ADD COLUMN "portal_enabled" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "orders" ADD CONSTRAINT "orders_pix_confirmed_by_users_id_fk" FOREIGN KEY ("pix_confirmed_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tenants" ADD CONSTRAINT "tenants_slug_unique" UNIQUE("slug");--> statement-breakpoint
-- Pix de pedidos anteriores à conferência já tinha sido recebido no fluxo antigo
UPDATE "orders" SET "pix_confirmed_at" = "delivered_at" WHERE "payment_method" = 'pix' AND "status" = 'entregue';