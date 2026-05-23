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
}

export interface EmployeeProfile extends JWTUser {
  workday_hours: number
  lunch_break_minutes: number
  hourly_rate: number | null
  geo_mode: 'required' | 'optional' | 'disabled'
  email: string | null
  lock_profile?: boolean
  theme?: 'dark' | 'light'
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
