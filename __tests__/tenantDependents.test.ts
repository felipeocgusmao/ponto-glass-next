import { describe, it, expect } from 'vitest'
import {
  TENANT_DEPENDENT_TABLES,
  EMPLOYEE_REFERENCING_TABLES,
  RECORD_REFERENCING_TABLES,
} from '@/lib/tenantDependents'

// Regression guard for the tenant-delete FK ordering bug: deleting a company
// failed with `employees_tenant_id_fkey` because audit_logs (which references
// employees.actor_id without ON DELETE CASCADE) was cleared AFTER employees,
// and compensation_requests wasn't cleared at all.
describe('tenant dependent deletion order', () => {
  const indexOf = (t: string) => TENANT_DEPENDENT_TABLES.indexOf(t as typeof TENANT_DEPENDENT_TABLES[number])

  it('clears employees last among employee-referencing tables', () => {
    const employeesIdx = indexOf('employees')
    expect(employeesIdx).toBeGreaterThanOrEqual(0)
    for (const table of EMPLOYEE_REFERENCING_TABLES) {
      const idx = indexOf(table)
      expect(idx, `${table} must be present in the deletion list`).toBeGreaterThanOrEqual(0)
      expect(idx, `${table} must be deleted before employees`).toBeLessThan(employeesIdx)
    }
  })

  it('clears record-referencing tables before records', () => {
    const recordsIdx = indexOf('records')
    for (const table of RECORD_REFERENCING_TABLES) {
      const idx = indexOf(table)
      expect(idx, `${table} must be present`).toBeGreaterThanOrEqual(0)
      expect(idx, `${table} must be deleted before records`).toBeLessThan(recordsIdx)
    }
  })

  it('includes the previously-missing compensation_requests and audit_logs', () => {
    expect(TENANT_DEPENDENT_TABLES).toContain('compensation_requests')
    expect(TENANT_DEPENDENT_TABLES).toContain('audit_logs')
    // audit_logs specifically must precede employees (the original bug)
    expect(indexOf('audit_logs')).toBeLessThan(indexOf('employees'))
  })

  it('has no duplicate entries', () => {
    const set = new Set(TENANT_DEPENDENT_TABLES)
    expect(set.size).toBe(TENANT_DEPENDENT_TABLES.length)
  })
})
