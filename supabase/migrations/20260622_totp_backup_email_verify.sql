-- v15 → v16: TOTP backup codes + email verification flow.
--
-- totp_backup_codes: array of SHA-256 hashes of the 10 single-use recovery
-- codes generated when TOTP is first enabled. Each code is consumed on use
-- (removed from the array). When the list is exhausted the user must ask
-- an admin to reset TOTP or regenerate codes with a valid TOTP code.
--
-- pending_email / pending_email_token / pending_email_expires_at: staging
-- area for unconfirmed email changes. PATCH /api/me writes here and sends a
-- confirmation link; GET /api/auth/confirm-email promotes pending_email to
-- email and clears these three columns.

ALTER TABLE employees
  ADD COLUMN IF NOT EXISTS totp_backup_codes       jsonb DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS pending_email           text,
  ADD COLUMN IF NOT EXISTS pending_email_token     text,
  ADD COLUMN IF NOT EXISTS pending_email_expires_at timestamptz;
