import { describe, it, expect } from 'vitest'
import { normalizeCustomDomain, slugifyTenantInput } from '@/lib/tenantDomain'

describe('normalizeCustomDomain', () => {
  it('strips protocol, www, path and trailing slash from a pasted URL', () => {
    expect(normalizeCustomDomain('https://www.sscar.pt/')).toBe('sscar.pt')
    expect(normalizeCustomDomain('http://ponto.empresa.com/app?x=1')).toBe('ponto.empresa.com')
    expect(normalizeCustomDomain('WWW.Example.COM')).toBe('example.com')
  })

  it('passes through an already-bare domain', () => {
    expect(normalizeCustomDomain('ponto.empresa.com')).toBe('ponto.empresa.com')
  })

  it('returns null for empty / non-string input', () => {
    expect(normalizeCustomDomain('')).toBeNull()
    expect(normalizeCustomDomain('   ')).toBeNull()
    expect(normalizeCustomDomain(null)).toBeNull()
    expect(normalizeCustomDomain(undefined)).toBeNull()
  })

  it('keeps output within the domain regex used by the API', () => {
    const re = /^[a-z0-9.-]+\.[a-z]{2,}$/
    expect(re.test(normalizeCustomDomain('https://www.sscar.pt/')!)).toBe(true)
  })
})

describe('slugifyTenantInput', () => {
  it('coerces a pasted URL into a valid slug', () => {
    const out = slugifyTenantInput('https://www.sscar.pt/')
    expect(out).toBe('sscar-pt')
    expect(/^[a-z0-9]+(-[a-z0-9]+)*$/.test(out)).toBe(true)
  })

  it('lowercases and hyphenates spaces/symbols', () => {
    expect(slugifyTenantInput('Empresa A!!')).toBe('empresa-a')
    expect(slugifyTenantInput('  Açao _ 2  ')).toBe('a-ao-2')
  })

  it('trims leading/trailing hyphens and caps length', () => {
    expect(slugifyTenantInput('---hi---')).toBe('hi')
    expect(slugifyTenantInput('a'.repeat(60)).length).toBeLessThanOrEqual(40)
  })

  it('returns empty string when nothing usable remains', () => {
    expect(slugifyTenantInput('!!!')).toBe('')
    expect(slugifyTenantInput(null)).toBe('')
  })
})
