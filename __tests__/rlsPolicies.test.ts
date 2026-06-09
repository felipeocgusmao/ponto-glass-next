import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { join } from 'path'

// Every per-tenant table must (1) have RLS enabled and (2) deny anon access on
// ALL operations. This test reads the consolidated schema.sql and is the cheap
// guard that catches "added a new table, forgot to lock it down" before review.
const TENANT_TABLES = [
  'tenants',
  'employees',
  'records',
  'correction_requests',
  'audit_logs',
  'day_exceptions',
  'hour_bank_adjustments',
  'push_subscriptions',
] as const

describe('RLS lockdown (phase 3)', () => {
  const schema = readFileSync(join(__dirname, '..', 'supabase', 'schema.sql'), 'utf8')

  it.each(TENANT_TABLES)('enables RLS on %s', (table) => {
    expect(schema).toMatch(new RegExp(`ALTER TABLE\\s+${table}\\s+ENABLE ROW LEVEL SECURITY`, 'i'))
  })

  it.each(TENANT_TABLES)('has a restrictive deny-anon policy on %s', (table) => {
    // Match a CREATE POLICY block that targets `anon` on this table with
    // USING (false) — sufficient to reject every operation. The exact policy
    // name is allowed to vary so the test doesn't churn on renames.
    const policyRe = new RegExp(
      `CREATE POLICY[\\s\\S]*?ON\\s+${table}[\\s\\S]*?TO\\s+anon[\\s\\S]*?USING\\s*\\(\\s*false\\s*\\)`,
      'i',
    )
    expect(schema).toMatch(policyRe)
  })

  it('does NOT ship tenant-aware policies (those go live with Supabase Auth, later)', () => {
    // Sanity guard: the template in the migration uses auth.jwt(). If anything
    // matching that lands in schema.sql by accident, every authenticated read
    // in production would return zero rows because the service-role key
    // bypasses RLS but auth.jwt() is also empty for it.
    const uncommented = schema
      .split('\n')
      .filter(line => !line.trim().startsWith('--'))
      .join('\n')
    expect(uncommented).not.toMatch(/auth\.jwt\s*\(\)/)
  })
})
