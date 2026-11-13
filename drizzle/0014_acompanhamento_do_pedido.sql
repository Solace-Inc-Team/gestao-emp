ALTER TABLE "orders" ADD COLUMN "tracking_id" uuid DEFAULT gen_random_uuid() NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "orders_tracking_uq" ON "orders" USING btree ("tracking_id");