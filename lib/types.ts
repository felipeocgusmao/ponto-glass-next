export interface Tenant {
  id: string
  name: string
  slug: string
  domain: string | null
  plan: string
  active: boolean
  created_at: string
}

export interface Employee {
  id: string
  name: string
  username: string
  email: string | null
  role: 'admin' | 'manager' | 'employee'
  active: boolean
  created_at: string
  workday_hours: number
  lunch_break_minutes: number
  hourly_rate: number | null
  geo_mode: 'required' | 'optional' | 'disabled'
  lock_profile?: boolean
  theme?: 'dark' | 'light'
  expected_start?: string | null
  expected_end?: string | null
  shift_start?: string
  workplace_lat?: number | null
  workplace_lng?: number | null
  max_distance_meters?: number | null
}

export interface PunchRecord {
  id: string
  employee_id: string
  employee_name: string
  type: 'entrada' | 'saída' | 'inicio_almoco' | 'fim_almoco' | 'pausa_cafe' | 'retorno_cafe'
  timestamp: string
  date: string
  latitude?: number | null
  longitude?: number | null
  comment?: string | null
}

export interface JWTUser {
  id: string
  name: string
  username: string
  role: 'admin' | 'manager' | 'employee'
  // Optional only for backward compatibility with tokens issued before phase 2.
  // verifyApiAuth always returns ApiUser, which has tenant_id populated from the DB.
  tenant_id?: string
}

// Trusted user identity inside an authenticated API handler: same fields as
// JWTUser but tenant_id is guaranteed and super_admin is always present —
// both loaded fresh from the database, never trusted from the token.
export interface ApiUser extends JWTUser {
  tenant_id: string
  super_admin: boolean
}

export interface EmployeeProfile extends JWTUser {
  super_admin?: boolean
  workday_hours: number
  lunch_break_minutes: number
  hourly_rate: number | null
  geo_mode: 'required' | 'optional' | 'disabled'
  workplace_lat?: number | null
  workplace_lng?: number | null
  max_distance_meters?: number | null
  email: string | null
  lock_profile?: boolean
  theme?: 'dark' | 'light'
  expected_start?: string | null
  expected_end?: string | null
  shift_start?: string | null
}

export interface AuditLog {
  id: string
  actor_id: string | null
  actor_name: string
  action: string
  target_id: string | null
  target_name: string | null
  details: Record<string, unknown> | null
  created_at: string
}

export interface HourBankAdjustment {
  id: string
  employee_id: string
  minutes: number
  reason: string
  date: string
  created_by: string | null
  created_at: string
}

export interface CorrectionRequest {
  id: string
  employee_id: string
  employee_name: string
  req_type: string
  req_timestamp: string
  req_date: string
  reason: string | null
  status: 'pending' | 'approved' | 'rejected'
  reviewer_id: string | null
  reviewer_name: string | null
  reviewer_note: string | null
  created_at: string
  resolved_at: string | null
}

export interface DayException {
  id: string
  date: string
  type: 'holiday' | 'day_off'
  description: string
  employee_id: string | null
  created_by: string | null
  created_at: string
}
