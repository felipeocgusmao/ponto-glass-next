'use client'

import { useState, useEffect, useCallback } from 'react'
import type { Employee, PunchRecord } from '@/lib/types'
import { businessDate } from '@/lib/utils'
import { SL } from '../../_lib/helpers'
import { useLang } from '@/lib/LangContext'
import type { TranslationKey } from '@/lib/i18n'
import * as XLSX from 'xlsx'
import { IconDownload, IconRefresh, IconSearch } from '../icons'

interface TimesheetApproval { id: string; employee_id: string; week_start: string; approved_by_name: string; created_at: string }

function mondayOf(dateStr: string): string {
  const d = new Date(dateStr + 'T12:00:00')
  const day = d.getDay()
  const diff = day === 0 ? -6 : 1 - day
  d.setDate(d.getDate() + diff)
  return d.toISOString().split('T')[0]
}

function TimesheetApprovalSection({ employees }: { employees: Employee[] }) {
  const { t } = useLang()
  const [open, setOpen] = useState(false)
  const [selEmpId, setSelEmpId] = useState('')
  const [weekStart, setWeekStart] = useState(mondayOf(businessDate()))
  const [approvals, setApprovals] = useState<TimesheetApproval[]>([])
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null)

  const load = useCallback(async () => {
    if (!selEmpId) return
    setLoading(true)
    try {
      const res = await fetch(`/api/timesheet-approvals?employeeId=${selEmpId}`)
      if (res.ok) setApprovals(await res.json())
    } catch { /* silent */ }
    finally { setLoading(false) }
  }, [selEmpId])

  useEffect(() => { if (open && selEmpId) load() }, [open, selEmpId, load])

  const approve = async () => {
    if (!selEmpId || !weekStart) return
    setSaving(true); setMsg(null)
    try {
      const res = await fetch('/api/timesheet-approvals', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ employeeId: selEmpId, weekStart }),
      })
      const d = await res.json()
      if (res.ok) { setApprovals(prev => [d, ...prev.filter(a => a.week_start !== weekStart)]); setMsg({ ok: true, text: 'Semana aprovada.' }) }
      else setMsg({ ok: false, text: d.error ?? t('reg.err.approve') })
    } catch { setMsg({ ok: false, text: t('error.connect') }) }
    finally { setSaving(false) }
  }

  const revoke = async (id: string) => {
    const res = await fetch(`/api/timesheet-approvals?id=${id}`, { method: 'DELETE' })
    if (res.ok) setApprovals(prev => prev.filter(a => a.id !== id))
  }

  const isApproved = approvals.some(a => a.week_start === weekStart)

  return (
    <div className="card" style={{ marginBottom: 16 }}>
      <div className="card-head" style={{ cursor: 'pointer', userSelect: 'none' }} onClick={() => setOpen(o => !o)}>
        <div className="card-title">Aprovação de semanas</div>
        <span style={{ fontSize: 12, color: 'var(--fg-muted)' }}>{open ? '▲' : '▼'}</span>
      </div>
      {open && (
        <div style={{ padding: '12px 20px', display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'flex-end' }}>
            <div className="field" style={{ marginBottom: 0 }}>
              <label>Funcionário</label>
              <select value={selEmpId} onChange={e => { setSelEmpId(e.target.value); setMsg(null) }} className="input" style={{ minWidth: 180 }}>
                <option value="">Selecionar…</option>
                {employees.map(e => <option key={e.id} value={e.id}>{e.name}</option>)}
              </select>
            </div>
            <div className="field" style={{ marginBottom: 0 }}>
              <label>Semana (segunda-feira)</label>
              <input type="date" value={weekStart} onChange={e => setWeekStart(mondayOf(e.target.value))} className="input" />
            </div>
            <button className={`btn ${isApproved ? '' : 'primary'}`} onClick={approve} disabled={!selEmpId || !weekStart || saving}>
              {isApproved ? '✓ Já aprovada' : saving ? 'A aprovar…' : 'Aprovar semana'}
            </button>
          </div>
          {msg && <div className={`alert-inline ${msg.ok ? 'ok' : 'err'}`}>{msg.text}</div>}
          {selEmpId && !loading && approvals.length > 0 && (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
              {approvals.slice(0, 12).map(a => (
                <div key={a.id} style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '4px 8px', background: 'var(--surface-2)', borderRadius: 6 }}>
                  <span className="chip success" style={{ fontSize: 10 }}>{a.week_start}</span>
                  <span style={{ fontSize: 11, color: 'var(--fg-muted)' }}>por {a.approved_by_name}</span>
                  <button onClick={() => revoke(a.id)} style={{ border: 'none', background: 'none', cursor: 'pointer', color: 'var(--danger-fg)', fontSize: 11, padding: '0 2px' }}>✕</button>
                </div>
              ))}
            </div>
          )}
          {selEmpId && !loading && approvals.length === 0 && (
            <div style={{ fontSize: 12, color: 'var(--fg-muted)' }}>{t('reg.no_weeks')}</div>
          )}
        </div>
      )}
    </div>
  )
}

function pad(n: number) { return String(n).padStart(2, '0') }
function ymd(d: Date) { return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}` }
function shiftDays(base: string, days: number) {
  const d = new Date(base + 'T12:00:00'); d.setDate(d.getDate() + days); return ymd(d)
}

// ── Bulk entry modal ──────────────────────────────────────────────────────────

const WEEKDAY_LABELS = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb']
const DEFAULT_SCHEDULE = [
  { type: 'entrada',       time: '09:00' },
  { type: 'inicio_almoco', time: '12:00' },
  { type: 'fim_almoco',    time: '13:00' },
  { type: 'saída',         time: '18:00' },
]

function BulkModal({ employees, onClose, onCreated }: {
  employees: Employee[]
  onClose: () => void
  onCreated: () => void
}) {
  const { t } = useLang()
  const today = businessDate()
  const [empId, setEmpId]       = useState('')
  const [dateFrom, setDateFrom] = useState(today)
  const [dateTo, setDateTo]     = useState(today)
  const [weekdays, setWeekdays] = useState<number[]>([1, 2, 3, 4, 5]) // Mon-Fri default
  const [schedule, setSchedule] = useState(DEFAULT_SCHEDULE.map(s => ({ ...s })))
  const [saving, setSaving]     = useState(false)
  const [err, setErr]           = useState('')
  const [ok, setOk]             = useState('')

  // Count how many days will be created
  const previewDays = (() => {
    if (!dateFrom || !dateTo || dateFrom > dateTo) return 0
    let count = 0
    const cur = new Date(dateFrom + 'T12:00:00')
    const end = new Date(dateTo + 'T12:00:00')
    while (cur <= end) {
      if (weekdays.includes(cur.getDay())) count++
      cur.setDate(cur.getDate() + 1)
    }
    return count
  })()
  const previewRecords = previewDays * schedule.length

  const toggleWeekday = (d: number) =>
    setWeekdays(prev => prev.includes(d) ? prev.filter(x => x !== d) : [...prev, d].sort())

  const updateScheduleTime = (i: number, time: string) =>
    setSchedule(prev => prev.map((s, idx) => idx === i ? { ...s, time } : s))

  const updateScheduleType = (i: number, type: string) =>
    setSchedule(prev => prev.map((s, idx) => idx === i ? { ...s, type } : s))

  const addRow = () =>
    setSchedule(prev => [...prev, { type: 'entrada', time: '09:00' }])

  const removeRow = (i: number) =>
    setSchedule(prev => prev.filter((_, idx) => idx !== i))

  const handleSubmit = async () => {
    setErr(''); setOk('')
    if (!empId)                       return setErr(t('reg.bulk_err.no_emp'))
    if (!dateFrom || !dateTo || dateFrom > dateTo) return setErr(t('reg.bulk_err.no_dates'))
    if (weekdays.length === 0)        return setErr(t('reg.bulk_err.no_days'))
    if (schedule.length === 0)        return setErr(t('reg.bulk_err.no_punch'))

    setSaving(true)
    try {
      const records: { employeeId: string; type: string; timestamp: string }[] = []
      const cur = new Date(dateFrom + 'T12:00:00')
      const end = new Date(dateTo + 'T12:00:00')
      while (cur <= end) {
        if (weekdays.includes(cur.getDay())) {
          const dateStr = ymd(cur)
          for (const row of schedule) {
            const [h, m] = row.time.split(':').map(Number)
            const ts = new Date(cur)
            ts.setHours(h, m, 0, 0)
            records.push({ employeeId: empId, type: row.type, timestamp: ts.toISOString() })
          }
        }
        cur.setDate(cur.getDate() + 1)
      }

      const res = await fetch('/api/records/bulk', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ records }),
      })
      const data = await res.json()
      if (res.ok) {
        setOk(t('reg.bulk_success').replace('{n}', String(data.created ?? records.length)))
        onCreated()
        setTimeout(onClose, 1500)
      } else {
        setErr(data.error ?? t('error.connect'))
      }
    } catch { setErr(t('error.connect')) }
    finally { setSaving(false) }
  }

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 1000,
      background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(4px)',
      display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16,
    }} onClick={e => { if (e.target === e.currentTarget) onClose() }}>
      <div className="card" style={{
        width: '100%', maxWidth: 540, maxHeight: '90vh', overflowY: 'auto',
        display: 'flex', flexDirection: 'column', gap: 0,
      }}>
        <div className="card-head" style={{ position: 'sticky', top: 0, zIndex: 1, background: 'var(--glass-bg)', backdropFilter: 'blur(var(--glass-blur)) saturate(var(--glass-saturate))', WebkitBackdropFilter: 'blur(var(--glass-blur)) saturate(var(--glass-saturate))' }}>
          <div className="card-title">{t('reg.bulk_title')}</div>
          <button onClick={onClose} className="btn ghost sm">✕</button>
        </div>

        <div style={{ padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: 16 }}>
          {/* Employee */}
          <div className="field" style={{ marginBottom: 0 }}>
            <label>{t('reg.employee')}</label>
            <select value={empId} onChange={e => setEmpId(e.target.value)} className="input">
              <option value="">{t('reg.select')}</option>
              {employees.map(e => <option key={e.id} value={e.id}>{e.name}</option>)}
            </select>
          </div>

          {/* Date range */}
          <div className="form-grid-2">
            <div className="field" style={{ marginBottom: 0 }}>
              <label>{t('reg.bulk_date_from')}</label>
              <input type="date" value={dateFrom} onChange={e => { setDateFrom(e.target.value); if (e.target.value > dateTo) setDateTo(e.target.value) }} className="input" />
            </div>
            <div className="field" style={{ marginBottom: 0 }}>
              <label>{t('reg.bulk_date_to')}</label>
              <input type="date" value={dateTo} onChange={e => { setDateTo(e.target.value); if (e.target.value < dateFrom) setDateFrom(e.target.value) }} className="input" />
            </div>
          </div>

          {/* Weekday picker */}
          <div>
            <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--fg-muted)', marginBottom: 6 }}>{t('reg.bulk_weekdays')}</div>
            <div style={{ display: 'flex', gap: 6 }}>
              {WEEKDAY_LABELS.map((label, i) => (
                <button
                  key={i}
                  onClick={() => toggleWeekday(i)}
                  className={weekdays.includes(i) ? 'btn primary sm' : 'btn ghost sm'}
                  style={{ minWidth: 36, fontWeight: weekdays.includes(i) ? 700 : 400 }}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          {/* Daily schedule */}
          <div>
            <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--fg-muted)', marginBottom: 6 }}>{t('reg.bulk_schedule')}</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {schedule.map((row, i) => (
                <div key={i} style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                  <select value={row.type} onChange={e => updateScheduleType(i, e.target.value)} className="input" style={{ flex: 1 }}>
                    <option value="entrada">{t('punch.entrada')}</option>
                    <option value="saída">{t('punch.saída')}</option>
                    <option value="inicio_almoco">{t('punch.inicio_almoco')}</option>
                    <option value="fim_almoco">{t('punch.fim_almoco')}</option>
                    <option value="pausa_cafe">{t('punch.pausa_cafe')}</option>
                    <option value="retorno_cafe">{t('punch.retorno_cafe')}</option>
                  </select>
                  <input
                    type="time"
                    value={row.time}
                    onChange={e => updateScheduleTime(i, e.target.value)}
                    className="input"
                    style={{ width: 90 }}
                  />
                  <button onClick={() => removeRow(i)} className="btn ghost sm" style={{ flexShrink: 0 }}>✕</button>
                </div>
              ))}
              <button onClick={addRow} className="btn ghost sm" style={{ alignSelf: 'flex-start' }}>+ {t('reg.add_btn')}</button>
            </div>
          </div>

          {/* Preview */}
          {previewDays > 0 && schedule.length > 0 && (
            <div style={{ padding: '10px 14px', background: 'var(--surface-2)', borderRadius: 'var(--r-sm)', fontSize: 13 }}>
              {t('reg.bulk_preview').replace('{n}', String(previewRecords)).replace('{d}', String(previewDays))}
            </div>
          )}

          {err && <div className="alert-inline err">{err}</div>}
          {ok  && <div className="alert-inline ok">{ok}</div>}

          <button
            onClick={handleSubmit}
            disabled={saving || previewRecords === 0}
            className="btn primary"
            style={{ width: '100%', justifyContent: 'center' }}
          >
            {saving ? t('reg.bulk_creating') : t('reg.bulk_submit')}
          </button>
        </div>
      </div>
    </div>
  )
}

const PAGE_SIZE = 25
type RangePreset = 'today' | '7d' | '14d' | '30d' | 'all' | 'custom'

function presetRange(p: RangePreset, today: string): { from: string; to: string } | null {
  if (p === 'today') return { from: today, to: today }
  if (p === '7d')    return { from: shiftDays(today, -6),  to: today }
  if (p === '14d')   return { from: shiftDays(today, -13), to: today }
  if (p === '30d')   return { from: shiftDays(today, -29), to: today }
  if (p === 'all')   return { from: '2020-01-01', to: today }
  return null
}
function detectPreset(from: string, to: string, today: string): RangePreset {
  for (const p of ['today', '7d', '14d', '30d', 'all'] as RangePreset[]) {
    const r = presetRange(p, today)
    if (r && r.from === from && r.to === to) return p
  }
  return 'custom'
}

export function RegistrosTab({ employees }: { employees: Employee[] }) {
  const { t } = useLang()
  const today = businessDate()
  const [from, setFrom] = useState(today)
  const [to, setTo] = useState(today)
  const [empId, setEmpId] = useState('all')
  const [search, setSearch] = useState('')
  const [typeFilter, setTypeFilter] = useState<'all' | 'entrada' | 'saída' | 'inicio_almoco' | 'fim_almoco' | 'pausa_cafe' | 'retorno_cafe'>('all')
  const [records, setRecords] = useState<PunchRecord[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [deleting, setDeleting] = useState<string | null>(null)
  const [newEmpId, setNewEmpId] = useState('')
  const [newType, setNewType] = useState('entrada')
  const [newTs, setNewTs] = useState('')
  const [newSaving, setNewSaving] = useState(false)
  const [newErr, setNewErr] = useState('')
  const [newOk, setNewOk] = useState('')
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editTs, setEditTs] = useState('')
  const [editSaving, setEditSaving] = useState(false)
  const [commentingId, setCommentingId] = useState<string | null>(null)
  const [commentText, setCommentText] = useState('')
  const [commentSaving, setCommentSaving] = useState(false)
  const [page, setPage] = useState(1)
  const [showBulk, setShowBulk] = useState(false)

  const toLocalInput = (ts: string) => {
    const d = new Date(ts)
    return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16)
  }

  const handleFromChange = (val: string) => { setFrom(val); if (val > to) setTo(val) }
  const handleToChange   = (val: string) => { setTo(val);   if (val < from) setFrom(val) }

  const setPreset = (p: RangePreset) => {
    const r = presetRange(p, today); if (r) { setFrom(r.from); setTo(r.to) }
  }
  const activePreset = detectPreset(from, to, today)

  const load = useCallback(async () => {
    setLoading(true); setError('')
    try {
      const params = new URLSearchParams({ from, to })
      if (empId !== 'all') params.set('employeeId', empId)
      const res = await fetch(`/api/reports?${params}`)
      if (res.ok) setRecords((await res.json()).data)
      else { const d = await res.json(); setError(d.error ?? t('error.connect')) }
    } catch { setError(t('error.connect')) }
    finally { setLoading(false) }
  }, [from, to, empId, t])

  useEffect(() => { load(); setPage(1) }, [load])
  // Clamp the page when the record set shrinks (e.g. after deleting the last row on the last page).
  useEffect(() => {
    const totalPages = Math.max(1, Math.ceil(records.length / PAGE_SIZE))
    setPage(p => Math.min(p, totalPages))
  }, [records.length])

  const handleDelete = async (id: string) => {
    if (!confirm(t('reg.del_confirm'))) return
    setDeleting(id)
    try {
      const res = await fetch(`/api/records/${id}`, { method: 'DELETE' })
      if (res.ok) {
        setRecords(prev => prev.filter(r => r.id !== id))
        window.dispatchEvent(new Event('pg:records-changed'))
      }
      else { const d = await res.json(); setError(d.error ?? t('error.connect')) }
    } catch { setError(t('error.connect')) }
    finally { setDeleting(null) }
  }

  const handleAdd = async () => {
    if (!newEmpId || !newTs) { setNewErr(t('reg.fill_all')); return }
    setNewSaving(true); setNewErr(''); setNewOk('')
    try {
      const res = await fetch('/api/records', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ employeeId: newEmpId, type: newType, timestamp: new Date(newTs).toISOString() }),
      })
      const data = await res.json()
      if (res.ok) {
        setNewOk(t('reg.added')); setNewTs(''); setNewEmpId(''); setNewType('entrada')
        await load()
        window.dispatchEvent(new Event('pg:records-changed'))
      } else { setNewErr(data.error ?? t('error.connect')) }
    } catch { setNewErr(t('error.connect')) }
    finally { setNewSaving(false); setTimeout(() => setNewOk(''), 2000) }
  }

  const handleEdit = async (id: string) => {
    setEditSaving(true)
    try {
      const res = await fetch(`/api/records/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ timestamp: new Date(editTs).toISOString() }),
      })
      if (res.ok) {
        const updated = await res.json()
        setRecords(prev => prev.map(r => r.id === id ? { ...r, timestamp: updated.timestamp, date: updated.date } : r))
        setEditingId(null)
        window.dispatchEvent(new Event('pg:records-changed'))
      } else { const d = await res.json(); setError(d.error ?? t('error.connect')) }
    } catch { setError(t('error.connect')) }
    finally { setEditSaving(false) }
  }

  const handleSaveComment = async (id: string) => {
    setCommentSaving(true)
    try {
      const res = await fetch(`/api/records/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ comment: commentText || null }),
      })
      if (res.ok) {
        setRecords(prev => prev.map(r => r.id === id ? { ...r, comment: commentText || null } : r))
        setCommentingId(null)
      } else { const d = await res.json(); setError(d.error ?? t('error.connect')) }
    } catch { setError(t('error.connect')) }
    finally { setCommentSaving(false) }
  }

  const empName = (r: { employee_id: string; employee_name: string }) =>
    employees.find(e => e.id === r.employee_id)?.name ?? r.employee_name

  const exportExcel = () => {
    const rows = records.map(r => ({
      Funcionário: empName(r),
      Data: r.date,
      Hora: new Date(r.timestamp).toLocaleTimeString('pt-BR'),
      Tipo: tagLabel(r.type),
      Latitude: r.latitude ?? '',
      Longitude: r.longitude ?? '',
    }))
    const ws = XLSX.utils.json_to_sheet(rows)
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, 'Registos')
    XLSX.writeFile(wb, `registos_${from}_${to}.xlsx`)
  }

  const tagLabel = (type: string): string => {
    const map: Record<string, TranslationKey> = {
      entrada: 'punch.entrada', 'saída': 'punch.saída',
      inicio_almoco: 'punch.inicio_almoco', fim_almoco: 'punch.fim_almoco',
      pausa_cafe: 'punch.pausa_cafe', retorno_cafe: 'punch.retorno_cafe',
    }
    return map[type] ? t(map[type]) : type
  }

  return (
    <>
      {/* Page header */}
      <div className="page-head">
        <div>
          <div className="page-title">{t('tab.registros')}</div>
          <div className="page-sub">
            {loading ? t('common.loading') : records.length > 0 ? `${records.length} ${t('common.records')}` : t('reg.none')}
          </div>
        </div>
        <div className="page-actions">
          {records.length > 0 && (
            <button onClick={exportExcel} className="btn"><IconDownload size={13}/> Excel</button>
          )}
          <button className="btn" onClick={load}><IconRefresh size={13}/> Atualizar</button>
        </div>
      </div>

      {/* Filters */}
      <div className="card">
        <div style={{ padding: '12px 16px', display: 'flex', flexDirection: 'column', gap: 10 }}>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center' }}>
            <div style={{ position: 'relative', flex: '1 1 220px', maxWidth: 280 }}>
              <span style={{ position: 'absolute', left: 8, top: '50%', transform: 'translateY(-50%)', color: 'var(--fg-subtle)', display: 'inline-flex' }}>
                <IconSearch size={13} />
              </span>
              <input
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder={t('reg.search_emp')}
                className="input search"
                style={{ width: '100%' }}
              />
            </div>
            <select value={empId} onChange={e => setEmpId(e.target.value)} className="input" style={{ width: 'auto' }}>
              <option value="all">{t('reg.all_emp')}</option>
              {employees.map(e => <option key={e.id} value={e.id}>{e.name}</option>)}
            </select>
            <select value={typeFilter} onChange={e => setTypeFilter(e.target.value as typeof typeFilter)} className="input" style={{ width: 'auto' }}>
              <option value="all">Todos tipos</option>
              <option value="entrada">{t('punch.entrada')}</option>
              <option value="saída">{t('punch.saída')}</option>
              <option value="inicio_almoco">{t('punch.inicio_almoco')}</option>
              <option value="fim_almoco">{t('punch.fim_almoco')}</option>
              <option value="pausa_cafe">{t('punch.pausa_cafe')}</option>
              <option value="retorno_cafe">{t('punch.retorno_cafe')}</option>
            </select>
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center' }}>
            <div className="field" style={{ marginBottom: 0 }}>
              <label style={{ fontSize: 10.5 }}>De</label>
              <input type="date" value={from} onChange={e => handleFromChange(e.target.value)} className="input" />
            </div>
            <div className="field" style={{ marginBottom: 0 }}>
              <label style={{ fontSize: 10.5 }}>Até</label>
              <input type="date" value={to} onChange={e => handleToChange(e.target.value)} className="input" />
            </div>
            <div style={{ display: 'flex', gap: 6, marginLeft: 'auto' }}>
              <button className={`filter-pill${activePreset === 'today' ? ' active' : ''}`} onClick={() => setPreset('today')}>Hoje</button>
              <button className={`filter-pill${activePreset === '7d' ? ' active' : ''}`} onClick={() => setPreset('7d')}>7d</button>
              <button className={`filter-pill${activePreset === '14d' ? ' active' : ''}`} onClick={() => setPreset('14d')}>14d</button>
              <button className={`filter-pill${activePreset === '30d' ? ' active' : ''}`} onClick={() => setPreset('30d')}>30d</button>
            </div>
          </div>
        </div>
      </div>

      {/* Records list */}
      <div className="card">
        <div style={{ padding: '16px 20px' }}>
          {error && <div className="alert-inline err" style={{ marginBottom: 12 }}>{error}</div>}
          {loading
            ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                {[0,1,2,3,4].map(i => (
                  <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 0', borderBottom: '1px solid var(--divider)' }}>
                    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 6 }}>
                      <div className="skeleton skeleton-title" style={{ width: '35%' }} />
                      <div className="skeleton skeleton-text" style={{ width: '50%' }} />
                    </div>
                    <div className="skeleton" style={{ width: 56, height: 20, borderRadius: 99 }} />
                  </div>
                ))}
              </div>
            )
            : records.length === 0
              ? <div className="alert-inline info">{t('reg.none')}</div>
              : (() => {
                const q = search.trim().toLowerCase()
                const filteredRecords = records.filter(r => {
                  if (typeFilter !== 'all' && r.type !== typeFilter) return false
                  if (q) {
                    const name = (empName(r) || '').toLowerCase()
                    if (!name.includes(q)) return false
                  }
                  return true
                })
                if (filteredRecords.length === 0) {
                  return <div className="empty"><div className="title">{t('reg.none')}</div><div className="desc">{t('reg.filter_hint')}</div></div>
                }
                const totalPages = Math.ceil(filteredRecords.length / PAGE_SIZE)
                const paged = filteredRecords.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)
                const groupedByDate = new Map<string, typeof paged>()
                paged.forEach(r => {
                  if (!groupedByDate.has(r.date)) groupedByDate.set(r.date, [])
                  groupedByDate.get(r.date)!.push(r)
                })
                const groupEntries = Array.from(groupedByDate.entries())
                return (
                <>
                  {groupEntries.map(([groupDate, groupRecs]) => (
                    <div key={groupDate}>
                      <div style={{
                        position: 'sticky', top: 0, zIndex: 1,
                        background: 'var(--surface-2)', padding: '6px 12px',
                        fontSize: 11, fontWeight: 600, textTransform: 'uppercase',
                        letterSpacing: '0.04em', color: 'var(--fg-muted)',
                        borderRadius: 'var(--r-sm)', marginTop: 10, marginBottom: 4,
                      }}>
                        {new Date(groupDate + 'T12:00:00').toLocaleDateString('pt-PT', { weekday: 'long', day: '2-digit', month: 'long' })}
                        <span style={{ color: 'var(--fg-subtle)', fontWeight: 500, marginLeft: 6 }}>· {groupRecs.length} {groupRecs.length === 1 ? 'batida' : 'batidas'}</span>
                      </div>
                  {groupRecs.map(r => {
                    const isEditing = editingId === r.id
                    const isCommenting = commentingId === r.id
                    return (
                      <div key={r.id}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 0', borderBottom: isEditing || isCommenting ? 'none' : '1px solid var(--divider)' }}>
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--fg)' }}>{empName(r)}</div>
                            <div style={{ fontSize: 11, color: 'var(--fg-muted)', marginTop: 3 }}>
                              {new Date(r.timestamp).toLocaleTimeString('pt-BR')}
                            </div>
                            {r.comment && (
                              <div style={{ fontSize: 11, color: 'var(--fg-muted)', marginTop: 2, fontStyle: 'italic' }}>
                                💬 {r.comment}
                              </div>
                            )}
                          </div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
                            <span className={`chip ${r.type === 'entrada' ? 'success' : r.type === 'saída' ? 'danger' : 'warn'}`} style={{ fontSize: 11 }}>
                              {tagLabel(r.type)}
                            </span>
                            {r.latitude && r.longitude && (
                              <a href={`https://maps.google.com/?q=${r.latitude},${r.longitude}`} target="_blank" rel="noopener noreferrer"
                                style={{ fontSize: 12, color: 'var(--fg-muted)', textDecoration: 'none' }} title={t('reg.location')}>📍</a>
                            )}
                            <button onClick={() => { setCommentingId(isCommenting ? null : r.id); setCommentText(r.comment ?? '') }}
                              className={`btn ghost sm icon${r.comment ? ' active' : ''}`} title={t('reg.add_comment')}>💬</button>
                            <button onClick={() => { setEditingId(r.id); setEditTs(toLocalInput(r.timestamp)) }}
                              disabled={editSaving} className="btn ghost sm icon" title={t('common.edit')}>✏</button>
                            <button onClick={() => handleDelete(r.id)} disabled={deleting === r.id}
                              className="btn ghost sm icon" title={t('common.delete')}>{deleting === r.id ? '…' : '✕'}</button>
                          </div>
                        </div>
                        {isCommenting && (
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 0', borderBottom: '1px solid var(--divider)' }}>
                            <input value={commentText} onChange={e => setCommentText(e.target.value)} placeholder={t('reg.add_comment')} maxLength={500} className="input" style={{ flex: 1, fontSize: 13 }} />
                            <button onClick={() => handleSaveComment(r.id)} disabled={commentSaving} className="btn primary sm">
                              {commentSaving ? '…' : 'OK'}
                            </button>
                            <button onClick={() => setCommentingId(null)} className="btn ghost sm">✕</button>
                          </div>
                        )}
                        {isEditing && (
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 0', borderBottom: '1px solid var(--divider)' }}>
                            <input type="datetime-local" value={editTs} onChange={e => setEditTs(e.target.value)} className="input" style={{ flex: 1, fontSize: 13 }} />
                            <button onClick={() => handleEdit(r.id)} disabled={editSaving} className="btn primary sm">
                              {editSaving ? '…' : 'OK'}
                            </button>
                            <button onClick={() => setEditingId(null)} className="btn ghost sm">✕</button>
                          </div>
                        )}
                      </div>
                    )
                  })}
                    </div>
                  ))}
                  {totalPages > 1 && (
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, paddingTop: 12 }}>
                      <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1} className="btn ghost sm">‹ Ant</button>
                      <span style={{ fontSize: 12, color: 'var(--fg-muted)' }}>{page} / {totalPages}</span>
                      <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages} className="btn ghost sm">Próx ›</button>
                    </div>
                  )}
                </>
                )
              })()
          }
        </div>
      </div>

      {/* Timesheet approvals */}
      <TimesheetApprovalSection employees={employees} />

      {/* Bulk modal */}
      {showBulk && (
        <BulkModal
          employees={employees}
          onClose={() => setShowBulk(false)}
          onCreated={() => { load(); window.dispatchEvent(new Event('pg:records-changed')) }}
        />
      )}

      {/* Add new record */}
      <div className="card">
        <div style={{ padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <SL>{t('reg.new_record')}</SL>
            <button className="btn sm" onClick={() => setShowBulk(true)}>{t('reg.bulk_btn')}</button>
          </div>
          <div className="field">
            <label>{t('reg.employee')}</label>
            <select value={newEmpId} onChange={e => setNewEmpId(e.target.value)} className="input">
              <option value="">{t('reg.select')}</option>
              {employees.map(e => <option key={e.id} value={e.id}>{e.name}</option>)}
            </select>
          </div>
          <div className="form-grid-2">
            <div className="field">
              <label>{t('reg.type')}</label>
              <select value={newType} onChange={e => setNewType(e.target.value)} className="input">
                <option value="entrada">{t('punch.entrada')}</option>
                <option value="saída">{t('punch.saída')}</option>
                <option value="inicio_almoco">{t('punch.inicio_almoco')}</option>
                <option value="fim_almoco">{t('punch.fim_almoco')}</option>
                <option value="pausa_cafe">{t('punch.pausa_cafe')}</option>
                <option value="retorno_cafe">{t('punch.retorno_cafe')}</option>
              </select>
            </div>
            <div className="field">
              <label>{t('reg.datetime')}</label>
              <input type="datetime-local" value={newTs} onChange={e => setNewTs(e.target.value)} className="input" />
            </div>
          </div>
          {newErr && <div className="alert-inline err">{newErr}</div>}
          {newOk  && <div className="alert-inline ok">{newOk}</div>}
          <button onClick={handleAdd} disabled={newSaving} className="btn primary" style={{ width: '100%', justifyContent: 'center' }}>
            {newSaving ? t('reg.adding') : t('reg.add_btn')}
          </button>
        </div>
      </div>
    </>
  )
}
