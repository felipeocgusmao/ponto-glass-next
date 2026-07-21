import { supabase } from '@/lib/supabase'
import { calcDayRounded, businessDate } from '@/lib/utils'
import { targetMinutesForDate, type ScheduledEmployee } from '@/lib/schedule'
import type { PunchRecord } from '@/lib/types'

// Single source of truth for hour-bank balances (#289). Previously the
// /api/hour-bank route computed this inline while alert-check and
// hour-bank-cap each read from a `hour_bank_balances` table that was never
// created — those two crons silently no-op'd forever (the negative-balance
// alert and the automatic cap never fired). Centralising here means the API,
// the low-balance alert and the cap now always agree, and all three pick up
// the per-weekday targets (#287) automatically.

interface BankEmployee extends ScheduledEmployee {
  lunch_break_minutes: number
}

// Σ(rounded daily net − per-weekday target) over closed days (a `saída`
// present). Shared by both the bulk and single-employee paths below.
function sumRawBalance(emp: BankEmployee, byDate: Map<string, PunchRecord[]>): number {
  let raw = 0
  byDate.forEach((dayRecs, date) => {
    if (!dayRecs.some(r => r.type === 'saída')) return
    raw += calcDayRounded(dayRecs, emp.lunch_break_minutes) - targetMinutesForDate(emp, date)
  })
  return raw
}

/**
 * Hour-bank balance in minutes for every active employee in a tenant
 * (3 queries total, same shape the admin dashboard/reports already relied on
 * via /api/hour-bank?all=true).
 */
export async function getHourBankBalances(tenantId: string): Promise<Record<string, number>> {
  const today = businessDate()

  const [{ data: emps }, { data: records }, { data: adjustments }] = await Promise.all([
    supabase.from('employees').select('id, workday_hours, lunch_break_minutes, weekly_schedule')
      .eq('tenant_id', tenantId).eq('active', true),
    supabase.from('records').select('employee_id, type, timestamp, date')
      .eq('tenant_id', tenantId)
      .lt('date', today).order('timestamp', { ascending: true }),
    supabase.from('hour_bank_adjustments').select('employee_id, minutes')
      .eq('tenant_id', tenantId),
  ])

  const empMap = new Map((emps ?? []).map(e => [e.id as string, e as BankEmployee]))

  const byEmpDay = new Map<string, Map<string, PunchRecord[]>>()
  for (const r of (records ?? []) as PunchRecord[]) {
    if (!byEmpDay.has(r.employee_id)) byEmpDay.set(r.employee_id, new Map())
    const dm = byEmpDay.get(r.employee_id)!
    if (!dm.has(r.date)) dm.set(r.date, [])
    dm.get(r.date)!.push(r)
  }

  const adjByEmp = new Map<string, number>()
  for (const a of (adjustments ?? []) as { employee_id: string; minutes: number }[]) {
    adjByEmp.set(a.employee_id, (adjByEmp.get(a.employee_id) ?? 0) + a.minutes)
  }

  const balances: Record<string, number> = {}
  empMap.forEach((emp, empId) => {
    const raw = sumRawBalance(emp, byEmpDay.get(empId) ?? new Map())
    balances[empId] = Math.round(raw + (adjByEmp.get(empId) ?? 0))
  })

  return balances
}

/**
 * Balance for a single employee — scoped queries (not a bulk fetch + discard),
 * used by the per-employee /api/hour-bank GET path.
 */
export async function getHourBankBalance(tenantId: string, employeeId: string): Promise<number | null> {
  const { data: emp } = await supabase
    .from('employees')
    .select('workday_hours, lunch_break_minutes, weekly_schedule')
    .eq('tenant_id', tenantId)
    .eq('id', employeeId)
    .single()
  if (!emp) return null

  const today = businessDate()
  const [{ data: records }, { data: adjustments }] = await Promise.all([
    supabase.from('records').select('employee_id, type, timestamp, date')
      .eq('tenant_id', tenantId).eq('employee_id', employeeId)
      .lt('date', today).order('timestamp', { ascending: true }),
    supabase.from('hour_bank_adjustments').select('minutes')
      .eq('tenant_id', tenantId).eq('employee_id', employeeId),
  ])

  const byDate = new Map<string, PunchRecord[]>()
  for (const r of (records ?? []) as PunchRecord[]) {
    if (!byDate.has(r.date)) byDate.set(r.date, [])
    byDate.get(r.date)!.push(r)
  }

  const raw = sumRawBalance(emp as BankEmployee, byDate)
  const adjTotal = (adjustments ?? []).reduce((s: number, a: { minutes: number }) => s + a.minutes, 0)
  return Math.round(raw + adjTotal)
}

/**
 * Overtime minutes accumulated in a civil year, per active employee (#291,
 * art. 228.º CT annual cap — 150h médias/grandes empresas, 175h micro/
 * pequenas). Unlike the hour-bank balance this only counts the POSITIVE side
 * (Σ max(0, dayNet − target)) — a short day never offsets overtime accrued
 * elsewhere in the year, matching how the legal cap is meant to work.
 */
export async function getAnnualOvertimeMinutes(tenantId: string, year: number): Promise<Record<string, number>> {
  const yearStart = `${year}-01-01`
  const yearEnd = `${year}-12-31`

  const [{ data: emps }, { data: records }] = await Promise.all([
    supabase.from('employees').select('id, workday_hours, lunch_break_minutes, weekly_schedule')
      .eq('tenant_id', tenantId).eq('active', true),
    supabase.from('records').select('employee_id, type, timestamp, date')
      .eq('tenant_id', tenantId)
      .gte('date', yearStart).lte('date', yearEnd)
      .order('timestamp', { ascending: true }),
  ])

  const empMap = new Map((emps ?? []).map(e => [e.id as string, e as BankEmployee]))

  const byEmpDay = new Map<string, Map<string, PunchRecord[]>>()
  for (const r of (records ?? []) as PunchRecord[]) {
    if (!byEmpDay.has(r.employee_id)) byEmpDay.set(r.employee_id, new Map())
    const dm = byEmpDay.get(r.employee_id)!
    if (!dm.has(r.date)) dm.set(r.date, [])
    dm.get(r.date)!.push(r)
  }

  const overtime: Record<string, number> = {}
  empMap.forEach((emp, empId) => {
    let total = 0
    byEmpDay.get(empId)?.forEach((dayRecs, date) => {
      if (!dayRecs.some(r => r.type === 'saída')) return
      const net = calcDayRounded(dayRecs, emp.lunch_break_minutes)
      total += Math.max(0, net - targetMinutesForDate(emp, date))
    })
    overtime[empId] = Math.round(total)
  })

  return overtime
}
