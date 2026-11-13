ALTER TABLE "orders" ADD COLUMN "mp_payment_id" text;--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "mp_pix_code" text;--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "mp_amount_cents" integer;--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "mp_expires_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "tenants" ADD COLUMN "mp_token_enc" text;--> statement-breakpoint
ALTER TABLE "tenants" ADD COLUMN "mp_conta" text;