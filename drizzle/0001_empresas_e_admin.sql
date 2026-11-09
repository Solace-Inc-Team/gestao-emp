ALTER TABLE "tenants" ADD COLUMN "active" boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "platform_admin" boolean DEFAULT false NOT NULL;