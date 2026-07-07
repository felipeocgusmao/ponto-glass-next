-- ═══════════════════════════════════════════════════════════════════
--  PontoGlass — Migration: Trial period
--
--  Adds trial_ends_at to tenants. NULL = no trial (permanent plan).
--  A non-null value that is in the past means the trial has expired.
-- ═══════════════════════════════════════════════════════════════════

ALTER TABLE tenants
  ADD COLUMN IF NOT EXISTS trial_ends_at TIMESTAMPTZ;
