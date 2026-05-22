-- v8: lock_profile — admin can prevent employees from changing their password
ALTER TABLE employees
  ADD COLUMN IF NOT EXISTS lock_profile BOOLEAN NOT NULL DEFAULT false;
