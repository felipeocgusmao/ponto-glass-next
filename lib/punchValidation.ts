import { haversineMeters } from './utils'

// Pure validation helpers extracted from /api/punch so they can be unit-tested
// without mocking Supabase / cookies / rate-limit.

export type GeoMode = 'required' | 'optional' | 'disabled' | null | undefined

export interface GeofenceInput {
  geoMode: GeoMode
  /** GPS sent by the client, when present. */
  latitude?: unknown
  longitude?: unknown
  /** Configured workplace coordinates, when present in the DB. */
  workplaceLat?: number | null
  workplaceLng?: number | null
  maxDistanceMeters?: number | null
}

export type GeofenceResult =
  | { ok: true }
  | { ok: false; status: 400; error: string }

/**
 * Validate a punch attempt against the employee's geofencing policy.
 *
 * - Returns { ok: true } when there's no policy to enforce, when the client
 *   provided GPS that's within the configured radius, or when geofencing is
 *   disabled entirely.
 * - Returns { ok: false } with a 400 + user-facing error when:
 *     * the employee has a workplace configured and the GPS is missing or
 *       outside the radius
 *     * geo_mode is 'required' and no GPS was supplied
 *
 * NOTE: order of checks mirrors the original /api/punch handler so the
 * behaviour is identical — only the wrapping changed.
 */
export function validateGeofence(input: GeofenceInput): GeofenceResult {
  const { geoMode, latitude, longitude, workplaceLat, workplaceLng, maxDistanceMeters } = input

  if (geoMode === 'disabled') return { ok: true }

  const hasWorkplace = workplaceLat != null && workplaceLng != null && maxDistanceMeters != null

  if (hasWorkplace) {
    if (typeof latitude !== 'number' || typeof longitude !== 'number')
      return { ok: false, status: 400, error: 'Localização obrigatória para este funcionário.' }

    const dist = haversineMeters(latitude, longitude, workplaceLat!, workplaceLng!)
    if (dist > maxDistanceMeters!)
      return { ok: false, status: 400, error: `Fora do local de trabalho (${Math.round(dist)}m de distância, máximo ${maxDistanceMeters}m).` }

    return { ok: true }
  }

  if (geoMode === 'required') {
    if (typeof latitude !== 'number' || typeof longitude !== 'number')
      return { ok: false, status: 400, error: 'Localização obrigatória.' }
  }

  return { ok: true }
}

/**
 * Decide whether a freshly submitted punch is a duplicate of the most recent
 * one and should be rejected. The rule is: same type AND inside a short
 * de-dup window (default: 60s).
 *
 * Used to block accidental double-taps. NOT used to block legitimate state
 * transitions (entrada → saída).
 */
export function isDuplicatePunch(
  lastType: string | null | undefined,
  lastTimestampIso: string | null | undefined,
  newType: string,
  now: Date = new Date(),
  windowMs: number = 60_000,
): boolean {
  if (!lastType || !lastTimestampIso) return false
  if (lastType !== newType) return false
  const last = new Date(lastTimestampIso).getTime()
  if (Number.isNaN(last)) return false
  return now.getTime() - last < windowMs
}

/**
 * Resolve the instant a punch should be filed under. Offline punches send the
 * wall-clock of when they were queued (`queuedAt`); honour it only when it is
 * plausible — parseable, strictly in the past, and at most `maxAgeMs` old.
 * Anything else (absent, malformed, in the future, too old) falls back to `now`.
 */
export function resolvePunchTimestamp(
  queuedAt: unknown,
  now: Date = new Date(),
  maxAgeMs: number = 24 * 60 * 60 * 1000,
): Date {
  if (typeof queuedAt !== 'string') return now
  const q = new Date(queuedAt)
  if (Number.isNaN(q.getTime())) return now
  const age = now.getTime() - q.getTime()
  if (age <= 0 || age > maxAgeMs) return now
  return q
}

const VALID_TYPES = new Set([
  'entrada', 'saída', 'inicio_almoco', 'fim_almoco', 'pausa_cafe', 'retorno_cafe',
])

/** True when `t` is a punch type the API accepts. */
export function isValidPunchType(t: unknown): t is 'entrada' | 'saída' | 'inicio_almoco' | 'fim_almoco' | 'pausa_cafe' | 'retorno_cafe' {
  return typeof t === 'string' && VALID_TYPES.has(t)
}
