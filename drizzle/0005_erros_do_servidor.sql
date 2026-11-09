CREATE TABLE "error_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"fingerprint" text NOT NULL,
	"message" text NOT NULL,
	"stack" text DEFAULT '' NOT NULL,
	"path" text DEFAULT '' NOT NULL,
	"method" text DEFAULT '' NOT NULL,
	"kind" text DEFAULT '' NOT NULL,
	"count" integer DEFAULT 1 NOT NULL,
	"first_seen" timestamp with time zone DEFAULT now() NOT NULL,
	"last_seen" timestamp with time zone DEFAULT now() NOT NULL,
	"last_alert_at" timestamp with time zone,
	"resolved_at" timestamp with time zone,
	CONSTRAINT "error_events_fingerprint_unique" UNIQUE("fingerprint")
);
