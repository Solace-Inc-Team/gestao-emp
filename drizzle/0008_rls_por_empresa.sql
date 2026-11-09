-- Segunda camada de isolamento entre empresas, no próprio Postgres.
-- O app troca para o papel app_tenant dentro de withTenant() e informa a empresa em app.tenant_id.
-- Superusuário e dono das tabelas (conexão normal) não passam por RLS: login, admin e migrações seguem iguais.
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'app_tenant') THEN
    CREATE ROLE app_tenant NOLOGIN;
  END IF;
END
$$;--> statement-breakpoint
GRANT app_tenant TO CURRENT_USER;--> statement-breakpoint
GRANT USAGE ON SCHEMA public TO app_tenant;--> statement-breakpoint
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO app_tenant;--> statement-breakpoint
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO app_tenant;--> statement-breakpoint
DO $$
DECLARE
  t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['customers', 'products', 'shifts', 'orders', 'order_items', 'stock_movements',
                           'audit_log', 'customer_payments', 'expenses', 'users']
  LOOP
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('DROP POLICY IF EXISTS tenant_isolation ON %I', t);
    EXECUTE format(
      'CREATE POLICY tenant_isolation ON %I TO app_tenant
         USING (tenant_id = current_setting(''app.tenant_id'')::uuid)
         WITH CHECK (tenant_id = current_setting(''app.tenant_id'')::uuid)', t);
  END LOOP;
END
$$;--> statement-breakpoint
ALTER TABLE tenants ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
DROP POLICY IF EXISTS tenant_isolation ON tenants;--> statement-breakpoint
CREATE POLICY tenant_isolation ON tenants TO app_tenant
  USING (id = current_setting('app.tenant_id')::uuid)
  WITH CHECK (id = current_setting('app.tenant_id')::uuid);
