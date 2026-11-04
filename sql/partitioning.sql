-- Helper: Create monthly partitions for webhook_events and audit_logs
-- Usage: CALL ensure_month_partitions(2025, 9);

CREATE OR REPLACE PROCEDURE ensure_month_partitions(year int, month int)
LANGUAGE plpgsql AS $$
DECLARE
  start_date date := make_date(year, month, 1);
  end_date   date := (start_date + interval '1 month')::date;
  part_we    text := format('webhook_events_%s', to_char(start_date, 'YYYY_MM'));
  part_al    text := format('audit_logs_%s', to_char(start_date, 'YYYY_MM'));
BEGIN
  -- Ensure parent tables are partitioned (no-op if already partitioned)
  BEGIN
    EXECUTE 'ALTER TABLE webhook_events PARTITION BY RANGE (received_at)';
  EXCEPTION WHEN duplicate_table OR object_not_in_prerequisite_state THEN
    -- ignore
  END;

  BEGIN
    EXECUTE 'ALTER TABLE audit_logs PARTITION BY RANGE (created_at)';
  EXCEPTION WHEN duplicate_table OR object_not_in_prerequisite_state THEN
    -- ignore
  END;

  -- Create partitions if not exist
  EXECUTE format(
    'CREATE TABLE IF NOT EXISTS %I PARTITION OF webhook_events FOR VALUES FROM (%L) TO (%L)',
    part_we, start_date, end_date
  );

  EXECUTE format(
    'CREATE TABLE IF NOT EXISTS %I PARTITION OF audit_logs FOR VALUES FROM (%L) TO (%L)',
    part_al, start_date, end_date
  );
END; $$;

