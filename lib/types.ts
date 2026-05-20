export interface Employee {
  id: string
  name: string
  username: string
  role: 'admin' | 'manager' | 'employee'
  active: boolean
  created_at: string
  workday_hours: number
  lunch_break_minutes: number
  hourly_rate: number | null
  geo_mode: 'required' | 'optional' | 'disabled'
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
