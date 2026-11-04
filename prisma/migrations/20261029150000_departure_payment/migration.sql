-- The row lock held by UPDATE makes the payment check atomic even if a different API skips guards.
CREATE FUNCTION retzef_departure_payment() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF NEW.status IN ('IN_TRANSIT','INSTALLATION') AND NEW.status IS DISTINCT FROM OLD.status THEN
  IF current_setting('app.tenant_role',true)='ADMIN' AND length(trim(coalesce(current_setting('app.transition_override_reason',true),'')))>=2 THEN
    RETURN NEW;
  END IF;
  IF NEW.source_review_reason IS NOT NULL THEN RAISE EXCEPTION 'Store update requires review before departure'; END IF;
  IF NEW.total_cents<0 OR NEW.paid_amount_cents<NEW.total_cents OR (NEW.total_cents>0 AND NEW.payment_status<>'PAID')
    THEN RAISE EXCEPTION 'Full payment required before departure'; END IF;
 END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER departure_payment BEFORE UPDATE ON orders FOR EACH ROW EXECUTE FUNCTION retzef_departure_payment();

-- Moving a source line to another order must not escape its source ownership protection.
CREATE FUNCTION retzef_protect_woo_item_move() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF current_setting('app.woo_sync',true) IS DISTINCT FROM '1' AND NEW.order_id IS DISTINCT FROM OLD.order_id
 AND EXISTS(SELECT 1 FROM orders WHERE id=OLD.order_id AND woo_integration_id IS NOT NULL)
 THEN RAISE EXCEPTION 'Store items are read only'; END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER protect_woo_item_move BEFORE UPDATE ON order_items FOR EACH ROW EXECUTE FUNCTION retzef_protect_woo_item_move();
