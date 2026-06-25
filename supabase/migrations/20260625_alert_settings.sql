-- Add alert_settings JSONB column to tenants table.
-- Stores per-tenant push notification thresholds (hour bank low, long day, max positive).

ALTER TABLE tenants
  ADD COLUMN IF NOT EXISTS alert_settings JSONB;

NOTIFY pgrst, 'reload schema';
