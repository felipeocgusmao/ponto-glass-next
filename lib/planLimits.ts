// Plan → limit map for tenants.plan (#251). Pure constants: imported by both
// API routes (enforcement) and client components (usage display), so nothing
// here may touch server-only modules.
//
// Employee limits count ACTIVE employees only — deactivated ones don't consume
// a seat, so "archiving" someone frees room for their replacement.
export const PLAN_LIMITS: Record<string, number> = {
  free: 5,
  standard: 25,
  pro: 100,
  enterprise: Infinity,
}

export const PLAN_LABELS: Record<string, string> = {
  free: 'Free',
  standard: 'Standard',
  pro: 'Pro',
  enterprise: 'Enterprise',
}

export const PLANS = ['free', 'standard', 'pro', 'enterprise'] as const
export type Plan = typeof PLANS[number]

export function employeeLimitFor(plan: string | null | undefined): number {
  return PLAN_LIMITS[(plan ?? 'standard').toLowerCase()] ?? PLAN_LIMITS.standard
}

/** Human label for the limit ("5", "25", "100", "∞"). */
export function limitLabel(plan: string | null | undefined): string {
  const limit = employeeLimitFor(plan)
  return Number.isFinite(limit) ? String(limit) : '∞'
}

/** Returns true if adding one more active employee would exceed the plan. */
export function isAtLimit(plan: string | null | undefined, activeCount: number): boolean {
  return activeCount >= employeeLimitFor(plan)
}
