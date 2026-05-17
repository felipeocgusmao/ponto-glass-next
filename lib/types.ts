export interface Employee {
  id: string
  name: string
  username: string
  role: 'admin' | 'employee'
  active: boolean
  created_at: string
}

export interface PunchRecord {
  id: string
  employee_id: string
  employee_name: string
  type: 'entrada' | 'saída'
  timestamp: string
  date: string
}

export interface JWTUser {
  id: string
  name: string
  username: string
  role: 'admin' | 'employee'
}
