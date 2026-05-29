'use client'

import { useState, useEffect, useCallback } from 'react'
import type { Employee, PunchRecord } from '@/lib/types'
import { businessDate } from '@/lib/utils'
import { SL } from '../../_lib/helpers'
import { useLang } from '@/lib/LangContext'
import type { TranslationKey } from '@/lib/i18n'
import * as XLSX from 'xlsx'
import { IconDownload, IconRefresh, IconSearch } from '../icons'

const PAGE_SIZE = 25
type RangePreset = 'today' | '7d' | '14d' | '30d' | 'all' | 'custom'

function pad(n: number) { return String(n).padStart(2, '0') }
function ymd(d: Date) { return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}` }
function shiftDays(base: string, days: number) {
  const d = new Date(base + 'T12:00:00'); d.setDate(d.getDate() + days); return ymd(d)
}
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
      if (res.ok) setRecords(await res.json())
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
                placeholder="Buscar funcionário…"
                className="input search"
                style={{ width: '100%' }}
              />
            </div>
            <select value={empId} onChange={e => setEmpId(e.target.value)} className="input" style={{ width: 'auto' }}>
              <option value="all">Todos funcionários</option>
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
                  <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 0', borderBottom: '1px solid var(--border)' }}>
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
                  return <div className="empty"><div className="title">Nenhum registro corresponde</div><div className="desc">Ajuste a busca, o tipo ou o período.</div></div>
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
                        <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 0', borderBottom: isEditing || isCommenting ? 'none' : '1px solid var(--border)' }}>
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
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 0', borderBottom: '1px solid var(--border)' }}>
                            <input value={commentText} onChange={e => setCommentText(e.target.value)} placeholder={t('reg.add_comment')} maxLength={500} className="input" style={{ flex: 1, fontSize: 13 }} />
                            <button onClick={() => handleSaveComment(r.id)} disabled={commentSaving} className="btn primary sm">
                              {commentSaving ? '…' : 'OK'}
                            </button>
                            <button onClick={() => setCommentingId(null)} className="btn ghost sm">✕</button>
                          </div>
                        )}
                        {isEditing && (
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 0', borderBottom: '1px solid var(--border)' }}>
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

      {/* Add new record */}
      <div className="card">
        <div style={{ padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: 12 }}>
          <SL>{t('reg.new_record')}</SL>
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
