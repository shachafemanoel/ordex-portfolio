ALTER TABLE customers ADD COLUMN woo_integration_id UUID REFERENCES woo_integrations(id), ADD COLUMN woo_customer_id TEXT;
CREATE UNIQUE INDEX customers_woo_identity ON customers(tenant_id, woo_integration_id, woo_customer_id);
ALTER TABLE orders
  ADD COLUMN woo_integration_id UUID REFERENCES woo_integrations(id),
  ADD COLUMN source_modified_at TIMESTAMP(3),
  ADD COLUMN source_status TEXT,
  ADD COLUMN source_review_reason TEXT,
  ADD COLUMN source_shipping JSONB,
  ADD COLUMN address_overridden BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE products ADD COLUMN woo_integration_id UUID REFERENCES woo_integrations(id), ADD COLUMN source_modified_at TIMESTAMP(3);
ALTER TABLE order_items ADD COLUMN woo_line_id TEXT;
CREATE UNIQUE INDEX order_items_woo_line ON order_items(order_id, woo_line_id);
ALTER TABLE woo_sync_jobs ADD COLUMN locked_by UUID, ADD COLUMN payload JSONB, ADD COLUMN parent_id UUID;
CREATE INDEX woo_jobs_parent ON woo_sync_jobs(tenant_id, parent_id);
CREATE TRIGGER tenant_woo_customer BEFORE INSERT OR UPDATE ON customers FOR EACH ROW EXECUTE FUNCTION retzef_check_tenant_link('woo_integration_id','woo_integrations','id');
CREATE TRIGGER tenant_woo_order BEFORE INSERT OR UPDATE ON orders FOR EACH ROW EXECUTE FUNCTION retzef_check_tenant_link('woo_integration_id','woo_integrations','id');
CREATE TRIGGER tenant_woo_product BEFORE INSERT OR UPDATE ON products FOR EACH ROW EXECUTE FUNCTION retzef_check_tenant_link('woo_integration_id','woo_integrations','id');

-- Service accounts cannot sign in, but are members so store-origin history has a valid actor.
INSERT INTO tenant_memberships(id, tenant_id, user_id, role, is_active)
SELECT gen_random_uuid(), tenant_id, service_user_id, 'OPERATIONS', true FROM woo_integrations
WHERE service_user_id IS NOT NULL ON CONFLICT (tenant_id,user_id) DO NOTHING;

-- Server-owned source fields cannot be edited through any local API, including payment summary.
CREATE FUNCTION retzef_protect_woo_order() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF current_setting('app.woo_sync',true) = '1' THEN RETURN NEW; END IF;
 IF TG_OP='INSERT' THEN
   IF NEW.woo_integration_id IS NOT NULL THEN RAISE EXCEPTION 'Store commerce is read only'; END IF;
 ELSIF OLD.woo_integration_id IS NOT NULL AND
   ROW(NEW.woo_integration_id,NEW.woo_order_id,NEW.sub_total_cents,NEW.tax_cents,NEW.discount_cents,NEW.shipping_cents,NEW.total_cents,NEW.currency,NEW.paid_amount_cents,NEW.payment_status,NEW.last_payment_at,NEW.source_status,NEW.source_modified_at,NEW.source_review_reason,NEW.source_shipping)
   IS DISTINCT FROM
   ROW(OLD.woo_integration_id,OLD.woo_order_id,OLD.sub_total_cents,OLD.tax_cents,OLD.discount_cents,OLD.shipping_cents,OLD.total_cents,OLD.currency,OLD.paid_amount_cents,OLD.payment_status,OLD.last_payment_at,OLD.source_status,OLD.source_modified_at,OLD.source_review_reason,OLD.source_shipping)
 THEN RAISE EXCEPTION 'Store commerce is read only'; END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER protect_woo_order BEFORE INSERT OR UPDATE ON orders FOR EACH ROW EXECUTE FUNCTION retzef_protect_woo_order();

CREATE FUNCTION retzef_local_shipping_override() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF current_setting('app.woo_sync',true) IS DISTINCT FROM '1' AND
   ROW(NEW.city,NEW.street,NEW.number,NEW.floor,NEW.apartment,NEW.notes) IS DISTINCT FROM ROW(OLD.city,OLD.street,OLD.number,OLD.floor,OLD.apartment,OLD.notes)
 THEN UPDATE orders SET address_overridden=true WHERE shipping_address_id=NEW.id AND woo_integration_id IS NOT NULL; END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER local_shipping_override AFTER UPDATE ON addresses FOR EACH ROW EXECUTE FUNCTION retzef_local_shipping_override();

CREATE FUNCTION retzef_protect_woo_item() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE order_ref UUID;
BEGIN
 IF current_setting('app.woo_sync',true) = '1' THEN RETURN coalesce(NEW,OLD); END IF;
 order_ref := CASE WHEN TG_OP='DELETE' THEN OLD.order_id ELSE NEW.order_id END;
 IF EXISTS(SELECT 1 FROM orders WHERE id=order_ref AND woo_integration_id IS NOT NULL) THEN
   IF TG_OP <> 'UPDATE' THEN RAISE EXCEPTION 'Store items are read only'; END IF;
   IF ROW(NEW.order_id,NEW.sku,NEW.name,NEW.qty,NEW.unit_price_cents,NEW.total_cents,NEW.woo_line_id,NEW.product_id,NEW.woo_product_id,NEW.woo_variation_id)
     IS DISTINCT FROM ROW(OLD.order_id,OLD.sku,OLD.name,OLD.qty,OLD.unit_price_cents,OLD.total_cents,OLD.woo_line_id,OLD.product_id,OLD.woo_product_id,OLD.woo_variation_id)
   THEN RAISE EXCEPTION 'Store items are read only'; END IF;
 END IF;
 RETURN coalesce(NEW,OLD);
END $$;
CREATE TRIGGER protect_woo_item BEFORE INSERT OR UPDATE OR DELETE ON order_items FOR EACH ROW EXECUTE FUNCTION retzef_protect_woo_item();
