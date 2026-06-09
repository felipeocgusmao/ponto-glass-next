// Multi-tenancy constants and helpers. Phase 1 only exports the well-known
// default tenant id used by the schema's column DEFAULT so existing data can
// be referenced from app code. Phases 2-4 will add resolveTenantFromRequest()
// and friends here.

// Deterministic id of the default tenant created by migration 20260609.
// Every row that pre-dates multi-tenancy belongs here, and every legacy INSERT
// that omits tenant_id picks it up via the column DEFAULT.
export const DEFAULT_TENANT_ID = '00000000-0000-0000-0000-000000000001'
