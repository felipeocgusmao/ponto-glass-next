-- v9: employee theme preference stored server-side
ALTER TABLE employees
  ADD COLUMN IF NOT EXISTS theme TEXT NOT NULL DEFAULT 'dark'
  CHECK (theme IN ('dark', 'light'));
