ALTER TABLE "users" ADD COLUMN "session_version" INTEGER NOT NULL DEFAULT 0;

CREATE OR REPLACE FUNCTION retzef_check_tenant_link() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE referenced_value text; valid_link boolean;
BEGIN
 IF TG_OP = 'UPDATE' AND NEW.tenant_id = OLD.tenant_id AND (to_jsonb(NEW)->TG_ARGV[0]) IS NOT DISTINCT FROM (to_jsonb(OLD)->TG_ARGV[0]) THEN RETURN NEW; END IF;
 referenced_value := to_jsonb(NEW)->>TG_ARGV[0];
 IF referenced_value IS NULL THEN RETURN NEW; END IF;
 IF TG_ARGV[1] = 'users' THEN
  SELECT EXISTS(SELECT 1 FROM tenant_memberships WHERE user_id::text = referenced_value AND tenant_id = NEW.tenant_id AND is_active) INTO valid_link;
 ELSE
  EXECUTE format('SELECT EXISTS(SELECT 1 FROM %I WHERE %I::text = $1 AND tenant_id = $2)', TG_ARGV[1], TG_ARGV[2]) INTO valid_link USING referenced_value, NEW.tenant_id;
 END IF;
 IF NOT valid_link THEN RAISE EXCEPTION 'Referenced record is not available in this business' USING ERRCODE = '23503'; END IF;
 RETURN NEW;
END $$;
