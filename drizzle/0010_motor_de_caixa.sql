CREATE TYPE "public"."cash_entry_kind" AS ENUM('repasse', 'saida');--> statement-breakpoint
ALTER TYPE "public"."role" ADD VALUE 'caixa' BEFORE 'entregador';--> statement-breakpoint
CREATE TABLE "cash_entries" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"shift_id" uuid NOT NULL,
	"kind" "cash_entry_kind" NOT NULL,
	"amount_cents" integer NOT NULL,
	"note" text DEFAULT '' NOT NULL,
	"expense_id" uuid,
	"created_by" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"voided_at" timestamp with time zone,
	"voided_by" uuid,
	"void_reason" text
);
--> statement-breakpoint
ALTER TABLE "shifts" ADD COLUMN "resolution" text;--> statement-breakpoint
ALTER TABLE "shifts" ADD COLUMN "resolution_notes" text;--> statement-breakpoint
ALTER TABLE "shifts" ADD COLUMN "resolved_by" uuid;--> statement-breakpoint
ALTER TABLE "shifts" ADD COLUMN "resolved_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "cash_entries" ADD CONSTRAINT "cash_entries_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cash_entries" ADD CONSTRAINT "cash_entries_shift_id_shifts_id_fk" FOREIGN KEY ("shift_id") REFERENCES "public"."shifts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cash_entries" ADD CONSTRAINT "cash_entries_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cash_entries" ADD CONSTRAINT "cash_entries_voided_by_users_id_fk" FOREIGN KEY ("voided_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "cash_entries_shift_idx" ON "cash_entries" USING btree ("shift_id");--> statement-breakpoint
ALTER TABLE "shifts" ADD CONSTRAINT "shifts_resolved_by_users_id_fk" FOREIGN KEY ("resolved_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE cash_entries ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE POLICY tenant_isolation ON cash_entries TO app_tenant
  USING (tenant_id = current_setting('app.tenant_id')::uuid)
  WITH CHECK (tenant_id = current_setting('app.tenant_id')::uuid);
