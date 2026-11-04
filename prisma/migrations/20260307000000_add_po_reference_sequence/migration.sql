-- CreateSequence: po_reference_seq
-- Used by ops-action-service to generate unique PO reference numbers
-- without race conditions from concurrent MAX() queries.

-- Seed the sequence from the current max reference number
DO $$
DECLARE
  current_max INT;
BEGIN
  SELECT COALESCE(
    MAX(CAST(SUBSTRING(reference FROM 9) AS INTEGER)), 0
  ) INTO current_max
  FROM purchase_orders
  WHERE reference LIKE 'PO-' || EXTRACT(YEAR FROM NOW())::TEXT || '-%';

  EXECUTE format('CREATE SEQUENCE IF NOT EXISTS po_reference_seq START WITH %s', current_max + 1);
END $$;
