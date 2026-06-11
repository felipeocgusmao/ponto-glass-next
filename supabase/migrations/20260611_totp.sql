-- v14 → v15: TOTP two-factor authentication (opt-in per user).
--
-- totp_secret: base32 secret, set when the user STARTS enrolment. Only after
-- they confirm a valid code does totp_enabled flip to true — a half-finished
-- enrolment never locks anyone out.
-- Recovery for a lost authenticator: an admin clears both fields via
-- PATCH /api/employees/[id] { reset_totp: true } (audited).

ALTER TABLE employees
  ADD COLUMN IF NOT EXISTS totp_secret  TEXT,
  ADD COLUMN IF NOT EXISTS totp_enabled BOOLEAN NOT NULL DEFAULT false;
