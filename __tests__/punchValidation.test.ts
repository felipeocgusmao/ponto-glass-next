import { describe, it, expect } from 'vitest'
import { validateGeofence, isDuplicatePunch, isValidPunchType } from '../lib/punchValidation'

describe('validateGeofence', () => {
  it('passes when geo_mode is disabled regardless of inputs', () => {
    expect(validateGeofence({ geoMode: 'disabled' })).toEqual({ ok: true })
    expect(validateGeofence({
      geoMode: 'disabled', latitude: 40, longitude: -3,
      workplaceLat: 40.5, workplaceLng: -3.5, maxDistanceMeters: 50,
    })).toEqual({ ok: true })
  })

  it('passes when no workplace configured and geo_mode is optional', () => {
    expect(validateGeofence({ geoMode: 'optional' })).toEqual({ ok: true })
    expect(validateGeofence({ geoMode: undefined })).toEqual({ ok: true })
  })

  it('requires GPS when geo_mode is required (even without workplace)', () => {
    const r = validateGeofence({ geoMode: 'required' })
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.error).toMatch(/Localização obrigatória/)
  })

  it('passes when GPS is provided and geo_mode is required (no workplace)', () => {
    expect(validateGeofence({
      geoMode: 'required', latitude: 40.4, longitude: -3.7,
    })).toEqual({ ok: true })
  })

  it('rejects missing GPS when a workplace is configured', () => {
    const r = validateGeofence({
      geoMode: 'optional',
      workplaceLat: 40.4, workplaceLng: -3.7, maxDistanceMeters: 100,
    })
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.error).toMatch(/Localização obrigatória para este funcionário/)
  })

  it('accepts a punch within the geofence radius', () => {
    // Same point — distance 0, well within 100m.
    expect(validateGeofence({
      geoMode: 'optional',
      latitude: 40.4, longitude: -3.7,
      workplaceLat: 40.4, workplaceLng: -3.7, maxDistanceMeters: 100,
    })).toEqual({ ok: true })
  })

  it('rejects a punch outside the geofence radius with the actual distance', () => {
    // Lisbon → Madrid is hundreds of km; way over a 100m radius.
    const r = validateGeofence({
      geoMode: 'optional',
      latitude: 40.4168, longitude: -3.7038, // Madrid
      workplaceLat: 38.7223, workplaceLng: -9.1393, // Lisbon
      maxDistanceMeters: 100,
    })
    expect(r.ok).toBe(false)
    if (!r.ok) {
      expect(r.error).toMatch(/Fora do local de trabalho/)
      // The error should embed the actual distance and the max for transparency.
      expect(r.error).toMatch(/máximo 100m/)
    }
  })
})

describe('isDuplicatePunch', () => {
  const NOW = new Date('2026-05-26T10:00:00Z')

  it('returns false when there is no previous record', () => {
    expect(isDuplicatePunch(null, null, 'entrada', NOW)).toBe(false)
    expect(isDuplicatePunch(undefined, undefined, 'entrada', NOW)).toBe(false)
  })

  it('returns false when the previous type is different', () => {
    expect(isDuplicatePunch('entrada', '2026-05-26T09:59:30Z', 'saída', NOW)).toBe(false)
  })

  it('returns true when the same type was punched within the dedup window', () => {
    // 30s ago, same type, within the 60s default window.
    expect(isDuplicatePunch('entrada', '2026-05-26T09:59:30Z', 'entrada', NOW)).toBe(true)
  })

  it('returns false when the same type is older than the dedup window', () => {
    // 90s ago, same type — legitimate re-entry, not a double-tap.
    expect(isDuplicatePunch('entrada', '2026-05-26T09:58:30Z', 'entrada', NOW)).toBe(false)
  })

  it('honours a custom window', () => {
    // 90s ago, same type — within a 120s window.
    expect(isDuplicatePunch('entrada', '2026-05-26T09:58:30Z', 'entrada', NOW, 120_000)).toBe(true)
  })

  it('returns false when the timestamp is unparseable', () => {
    expect(isDuplicatePunch('entrada', 'not-a-date', 'entrada', NOW)).toBe(false)
  })
})

describe('isValidPunchType', () => {
  it('accepts every documented type', () => {
    for (const t of ['entrada', 'saída', 'inicio_almoco', 'fim_almoco', 'pausa_cafe', 'retorno_cafe']) {
      expect(isValidPunchType(t)).toBe(true)
    }
  })

  it('rejects unknown types', () => {
    expect(isValidPunchType('saida')).toBe(false) // missing the accent
    expect(isValidPunchType('lunch')).toBe(false)
    expect(isValidPunchType('')).toBe(false)
    expect(isValidPunchType(null)).toBe(false)
    expect(isValidPunchType(42)).toBe(false)
  })
})
