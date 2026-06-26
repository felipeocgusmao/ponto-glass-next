'use client'

import { useCallback, useMemo, useState } from 'react'
import type { Employee } from '@/lib/types'

export function useEmployeeList() {
  const [employees, setEmployees] = useState<Employee[]>([])

  // all=true brings deactivated employees too — the Funcionários tab shows
  // them under the "Inativos" filter with a restore action. Every other
  // consumer receives the active-only slice via activeEmployees.
  const loadEmployees = useCallback(async () => {
    try {
      const res = await fetch('/api/employees?all=true')
      if (res.ok) setEmployees(await res.json())
    } catch { /* silent */ }
  }, [])

  const activeEmployees = useMemo(
    () => employees.filter(e => e.active !== false),
    [employees],
  )

  return { employees, activeEmployees, loadEmployees, setEmployees }
}
