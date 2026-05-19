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
}

export interface PunchRecord {
  id: string
  employee_id: string
  employee_name: string
  type: 'entrada' | 'saída' | 'inicio_almoco' | 'fim_almoco' | 'pausa_cafe' | 'retorno_cafe'
  timestamp: string
  date: string
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
}
