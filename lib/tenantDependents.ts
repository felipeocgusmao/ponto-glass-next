// Ordered list of tenant-scoped child tables to clear before deleting a tenant.
//
// Postgres rejects deleting a row that another row still references, and many
// of these children point at `employees` through columns that are NOT
// ON DELETE CASCADE (audit_logs.actor_id, hour_bank_adjustments.created_by,
// day_exceptions.created_by, correction_requests.reviewer_id,
// compensation_requests.reviewer_id, records.employee_id). So the invariant is:
//
//   every table that references employees must appear BEFORE 'employees',
//   and every table that references records must appear BEFORE 'records'.
//
// Getting this order wrong (audit_logs was once listed after employees) makes a
// tenant delete fail with employees_tenant_id_fkey. The regression test in
// __tests__/tenantDependents.test.ts locks the invariant in place.
export const TENANT_DEPENDENT_TABLES = [
  'kiosk_photos',          // -> records, tenant
  'push_subscriptions',    // -> employees, tenant
  'login_sessions',        // -> employees, tenant
  'timesheet_approvals',   // -> employees, tenant
  'compensation_requests', // -> employees (employee_id, reviewer_id), tenant
  'correction_requests',   // -> employees (employee_id, reviewer_id), tenant
  'hour_bank_adjustments', // -> employees (employee_id, created_by), tenant
  'day_exceptions',        // -> employees (employee_id, created_by), tenant
  'records',               // -> employees, tenant
  'audit_logs',            // -> employees (actor_id), tenant
  'webhook_configs',       // -> tenant
  'shift_templates',       // -> tenant
  'employees',             // -> tenant
] as const

// Tables above that hold a foreign key into employees — each MUST be ordered
// before 'employees'. Used by the regression test to verify the ordering.
export const EMPLOYEE_REFERENCING_TABLES: readonly string[] = [
  'push_subscriptions',
  'login_sessions',
  'timesheet_approvals',
  'compensation_requests',
  'correction_requests',
  'hour_bank_adjustments',
  'day_exceptions',
  'records',
  'audit_logs',
]

// Tables that hold a foreign key into records — each MUST be ordered before
// 'records'.
export const RECORD_REFERENCING_TABLES: readonly string[] = ['kiosk_photos']
