-- RLS read policies — protects against direct anon key access.
-- The app uses service role (bypasses RLS), so these only matter
-- if someone ever queries Supabase with the anon/public key directly.

-- employees: no direct anon read (service role still works)
CREATE POLICY "block_anon_read_employees" ON employees
  FOR SELECT USING (false);

-- records: same
CREATE POLICY "block_anon_read_records" ON records
  FOR SELECT USING (false);

-- correction_requests: same
CREATE POLICY "block_anon_read_corrections" ON correction_requests
  FOR SELECT USING (false);

-- audit_logs: same
CREATE POLICY "block_anon_read_audit" ON audit_logs
  FOR SELECT USING (false);
