'use client'

import { useState, useEffect, useCallback } from 'react'
import type { Employee, PunchRecord } from '@/lib/types'
import { SL } from '../../_lib/helpers'
import { useLang } from '@/lib/LangContext'
import type { TranslationKey } from '@/lib/i18n'
import * as XLSX from 'xlsx'

const PAGE_SIZE = 25

export function RegistrosTab({ employees }: { employees: Employee[] }) {
  const { t } = useLang()
  const today = new Date().toISOString().split('T')[0]
  const [from, setFrom] = useState(today)
  const [to, setTo] = useState(today)
  const [empId, setEmpId] = useState('all')
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
  const [page, setPage] = useState(1)

  const toLocalInput = (ts: string) => {
    const d = new Date(ts)
    return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16)
  }

  const handleFromChange = (val: string) => { setFrom(val); if (val > to) setTo(val) }
  const handleToChange   = (val: string) => { setTo(val);   if (val < from) setFrom(val) }

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

  const handleDelete = async (id: string) => {
    if (!confirm(t('reg.del_confirm'))) return
    setDeleting(id)
    try {
      const res = await fetch(`/api/records/${id}`, { method: 'DELETE' })
      if (res.ok) setRecords(prev => prev.filter(r => r.id !== id))
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
      } else { const d = await res.json(); setError(d.error ?? t('error.connect')) }
    } catch { setError(t('error.connect')) }
    finally { setEditSaving(false) }
  }

  const exportExcel = () => {
    const rows = records.map(r => ({
      Funcionário: r.employee_name,
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
      <div className="card">
        <div style={{ padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: 12 }}>
          <SL>{t('reg.filters')}</SL>
          <div className="form-grid-2">
            <div className="field">
              <label>{t('reg.from')}</label>
              <input type="date" value={from} onChange={e => handleFromChange(e.target.value)} className="input" />
            </div>
            <div className="field">
              <label>{t('reg.to')}</label>
              <input type="date" value={to} onChange={e => handleToChange(e.target.value)} className="input" />
            </div>
          </div>
          <div className="field">
            <label>{t('reg.employee')}</label>
            <select value={empId} onChange={e => setEmpId(e.target.value)} className="input">
              <option value="all">{t('reg.all')}</option>
              {employees.map(e => <option key={e.id} value={e.id}>{e.name}</option>)}
            </select>
          </div>
        </div>
      </div>

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
                const totalPages = Math.ceil(records.length / PAGE_SIZE)
                const paged = records.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)
                return (
                <>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                    <SL style={{ margin: 0 }}>{records.length} {t('common.records')}</SL>
                    <button onClick={exportExcel} className="btn ghost sm" title="Exportar Excel">
                      ⬇ Excel
                    </button>
                  </div>
                  {paged.map(r => {
                    const isEditing = editingId === r.id
                    return (
                      <div key={r.id}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 0', borderBottom: '1px solid var(--border)' }}>
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--fg)' }}>{r.employee_name}</div>
                            <div style={{ fontSize: 11, color: 'var(--fg-muted)', marginTop: 3 }}>
                              {new Date(r.date + 'T12:00:00').toLocaleDateString('pt-BR', { weekday: 'short', day: '2-digit', month: 'short' })}
                              {' · '}
                              {new Date(r.timestamp).toLocaleTimeString('pt-BR')}
                            </div>
                          </div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
                            <span className={`chip ${r.type === 'entrada' ? 'success' : r.type === 'saída' ? 'danger' : 'warn'}`} style={{ fontSize: 11 }}>
                              {tagLabel(r.type)}
                            </span>
                            {r.latitude && r.longitude && (
                              <a href={`https://maps.google.com/?q=${r.latitude},${r.longitude}`} target="_blank" rel="noopener noreferrer"
                                style={{ fontSize: 12, color: 'var(--fg-muted)', textDecoration: 'none' }} title={t('reg.location')}>📍</a>
                            )}
                            <button onClick={() => { setEditingId(r.id); setEditTs(toLocalInput(r.timestamp)) }}
                              disabled={editSaving} className="btn ghost sm icon" title={t('common.edit')}>✏</button>
                            <button onClick={() => handleDelete(r.id)} disabled={deleting === r.id}
                              className="btn ghost sm icon" title={t('common.delete')}>{deleting === r.id ? '…' : '✕'}</button>
                          </div>
                        </div>
                        {isEditing && (
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 0' }}>
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
