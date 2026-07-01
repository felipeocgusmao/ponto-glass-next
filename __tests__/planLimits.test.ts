import { describe, it, expect } from 'vitest'
import { employeeLimitFor, limitLabel, PLAN_LIMITS } from '@/lib/planLimits'

describe('planLimits (#251)', () => {
  it('maps known plans to their limits', () => {
    expect(employeeLimitFor('standard')).toBe(PLAN_LIMITS.standard)
    expect(employeeLimitFor('pro')).toBe(PLAN_LIMITS.pro)
    expect(employeeLimitFor('enterprise')).toBe(Infinity)
  })

  it('is case-insensitive', () => {
    expect(employeeLimitFor('PRO')).toBe(PLAN_LIMITS.pro)
    expect(employeeLimitFor('Enterprise')).toBe(Infinity)
  })

  it('falls back to standard for unknown/missing plans', () => {
    expect(employeeLimitFor(null)).toBe(PLAN_LIMITS.standard)
    expect(employeeLimitFor(undefined)).toBe(PLAN_LIMITS.standard)
    expect(employeeLimitFor('plano-que-nao-existe')).toBe(PLAN_LIMITS.standard)
  })

  it('labels finite limits with the number and infinite with ∞', () => {
    expect(limitLabel('standard')).toBe(String(PLAN_LIMITS.standard))
    expect(limitLabel('enterprise')).toBe('∞')
  })
})
