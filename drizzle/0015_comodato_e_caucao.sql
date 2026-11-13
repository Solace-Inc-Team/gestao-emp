CREATE TABLE "container_loans" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"customer_id" uuid NOT NULL,
	"product_id" uuid NOT NULL,
	"quantity" integer NOT NULL,
	"deposit_cents" integer DEFAULT 0 NOT NULL,
	"deposit_method" "payment_method",
	"note" text DEFAULT '' NOT NULL,
	"user_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "order_items" ADD COLUMN "loan" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "container_loans" ADD CONSTRAINT "container_loans_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "container_loans" ADD CONSTRAINT "container_loans_customer_id_customers_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."customers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "container_loans" ADD CONSTRAINT "container_loans_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "container_loans" ADD CONSTRAINT "container_loans_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "container_loans_tenant_customer_idx" ON "container_loans" USING btree ("tenant_id","customer_id");--> statement-breakpoint
ALTER TABLE container_loans ENABLE ROW LEVEL SECURITY;
