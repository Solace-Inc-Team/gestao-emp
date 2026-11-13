CREATE TABLE "branches" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"name" text NOT NULL,
	"slug" text NOT NULL,
	"main" boolean DEFAULT false NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "customer_payments" ADD COLUMN "branch_id" uuid;--> statement-breakpoint
ALTER TABLE "expenses" ADD COLUMN "branch_id" uuid;--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "branch_id" uuid;--> statement-breakpoint
ALTER TABLE "shifts" ADD COLUMN "branch_id" uuid;--> statement-breakpoint
ALTER TABLE "stock_movements" ADD COLUMN "branch_id" uuid;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "branch_id" uuid;--> statement-breakpoint
INSERT INTO "branches" ("tenant_id", "name", "slug", "main") SELECT "id", 'Principal', 'principal', true FROM "tenants";--> statement-breakpoint
UPDATE "customer_payments" x SET "branch_id" = b."id" FROM "branches" b WHERE b."tenant_id" = x."tenant_id" AND b."main";--> statement-breakpoint
ALTER TABLE "customer_payments" ALTER COLUMN "branch_id" SET NOT NULL;--> statement-breakpoint
UPDATE "expenses" x SET "branch_id" = b."id" FROM "branches" b WHERE b."tenant_id" = x."tenant_id" AND b."main";--> statement-breakpoint
ALTER TABLE "expenses" ALTER COLUMN "branch_id" SET NOT NULL;--> statement-breakpoint
UPDATE "orders" x SET "branch_id" = b."id" FROM "branches" b WHERE b."tenant_id" = x."tenant_id" AND b."main";--> statement-breakpoint
ALTER TABLE "orders" ALTER COLUMN "branch_id" SET NOT NULL;--> statement-breakpoint
UPDATE "shifts" x SET "branch_id" = b."id" FROM "branches" b WHERE b."tenant_id" = x."tenant_id" AND b."main";--> statement-breakpoint
ALTER TABLE "shifts" ALTER COLUMN "branch_id" SET NOT NULL;--> statement-breakpoint
UPDATE "stock_movements" x SET "branch_id" = b."id" FROM "branches" b WHERE b."tenant_id" = x."tenant_id" AND b."main";--> statement-breakpoint
ALTER TABLE "stock_movements" ALTER COLUMN "branch_id" SET NOT NULL;--> statement-breakpoint
UPDATE "users" x SET "branch_id" = b."id" FROM "branches" b WHERE b."tenant_id" = x."tenant_id" AND b."main" AND x."role" <> 'dono';--> statement-breakpoint
ALTER TABLE "branches" ADD CONSTRAINT "branches_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "branches_tenant_slug_uq" ON "branches" USING btree ("tenant_id","slug");--> statement-breakpoint
CREATE UNIQUE INDEX "branches_tenant_name_uq" ON "branches" USING btree ("tenant_id",lower("name"));--> statement-breakpoint
CREATE UNIQUE INDEX "branches_tenant_main_uq" ON "branches" USING btree ("tenant_id") WHERE "branches"."main";--> statement-breakpoint
ALTER TABLE "customer_payments" ADD CONSTRAINT "customer_payments_branch_id_branches_id_fk" FOREIGN KEY ("branch_id") REFERENCES "public"."branches"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "expenses" ADD CONSTRAINT "expenses_branch_id_branches_id_fk" FOREIGN KEY ("branch_id") REFERENCES "public"."branches"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "orders" ADD CONSTRAINT "orders_branch_id_branches_id_fk" FOREIGN KEY ("branch_id") REFERENCES "public"."branches"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "shifts" ADD CONSTRAINT "shifts_branch_id_branches_id_fk" FOREIGN KEY ("branch_id") REFERENCES "public"."branches"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stock_movements" ADD CONSTRAINT "stock_movements_branch_id_branches_id_fk" FOREIGN KEY ("branch_id") REFERENCES "public"."branches"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "users" ADD CONSTRAINT "users_branch_id_branches_id_fk" FOREIGN KEY ("branch_id") REFERENCES "public"."branches"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "orders_branch_status_idx" ON "orders" USING btree ("branch_id","status");--> statement-breakpoint
CREATE INDEX "stock_branch_product_idx" ON "stock_movements" USING btree ("branch_id","product_id");--> statement-breakpoint
ALTER TABLE "branches" ENABLE ROW LEVEL SECURITY;
