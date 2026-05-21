'use client'

import { useState, useEffect, useCallback } from 'react'
import type { Employee, PunchRecord } from '@/lib/types'
import { SL } from '../../_lib/helpers'

export function RegistrosTab({ employees }: { employees: Employee[] }) {
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
      else { const d = await res.json(); setError(d.error ?? 'Erro ao carregar registros.') }
    } catch { setError('Erro ao conectar.') }
    finally { setLoading(false) }
  }, [from, to, empId])

  useEffect(() => { load() }, [load])

  const handleDelete = async (id: string) => {
    if (!confirm('Apagar este registro?')) return
    setDeleting(id)
    try {
      const res = await fetch(`/api/records/${id}`, { method: 'DELETE' })
      if (res.ok) setRecords(prev => prev.filter(r => r.id !== id))
      else { const d = await res.json(); setError(d.error ?? 'Erro ao apagar.') }
    } catch { setError('Erro de conexão.') }
    finally { setDeleting(null) }
  }

  const handleAdd = async () => {
    if (!newEmpId || !newTs) { setNewErr('Preencha todos os campos.'); return }
    setNewSaving(true); setNewErr(''); setNewOk('')
    try {
      const res = await fetch('/api/records', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ employeeId: newEmpId, type: newType, timestamp: new Date(newTs).toISOString() }),
      })
      const data = await res.json()
      if (res.ok) {
        setNewOk('Registo adicionado!'); setNewTs(''); setNewEmpId(''); setNewType('entrada')
        await load()
      } else { setNewErr(data.error ?? 'Erro ao adicionar.') }
    } catch { setNewErr('Erro de conexão.') }
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
      } else { const d = await res.json(); setError(d.error ?? 'Erro ao salvar.') }
    } catch { setError('Erro de conexão.') }
    finally { setEditSaving(false) }
  }

  const tagLabel: Record<string, string> = {
    entrada: 'Entrada', 'saída': 'Saída',
    inicio_almoco: 'Almoço', fim_almoco: 'Ret. Almoço',
    pausa_cafe: 'Café', retorno_cafe: 'Ret. Café',
  }

  return (
    <>
      <div className="card">
        <div style={{ padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: 12 }}>
          <SL>Filtros</SL>
          <div className="form-grid-2">
            <div className="field">
              <label>De</label>
              <input type="date" value={from} onChange={e => handleFromChange(e.target.value)} className="input" />
            </div>
            <div className="field">
              <label>Até</label>
              <input type="date" value={to} onChange={e => handleToChange(e.target.value)} className="input" />
            </div>
          </div>
          <div className="field">
            <label>Funcionário</label>
            <select value={empId} onChange={e => setEmpId(e.target.value)} className="input">
              <option value="all">Todos</option>
              {employees.map(e => <option key={e.id} value={e.id}>{e.name}</option>)}
            </select>
          </div>
        </div>
      </div>

      <div className="card">
        <div style={{ padding: '16px 20px' }}>
          {error && <div className="alert-inline err" style={{ marginBottom: 12 }}>{error}</div>}
          {loading
            ? <div className="alert-inline info">Carregando...</div>
            : records.length === 0
              ? <div className="alert-inline info">Nenhum registro para este filtro.</div>
              : (
                <>
                  <SL>{records.length} registro(s)</SL>
                  {records.map(r => {
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
                              {tagLabel[r.type] ?? r.type}
                            </span>
                            {r.latitude && r.longitude && (
                              <a href={`https://maps.google.com/?q=${r.latitude},${r.longitude}`} target="_blank" rel="noopener noreferrer"
                                style={{ fontSize: 12, color: 'var(--fg-muted)', textDecoration: 'none' }} title="Ver localização">📍</a>
                            )}
                            <button onClick={() => { setEditingId(r.id); setEditTs(toLocalInput(r.timestamp)) }}
                              disabled={editSaving} className="btn ghost sm icon" title="Editar horário">✏</button>
                            <button onClick={() => handleDelete(r.id)} disabled={deleting === r.id}
                              className="btn ghost sm icon" title="Apagar">{deleting === r.id ? '…' : '✕'}</button>
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
                </>
              )
          }
        </div>
      </div>

      <div className="card">
        <div style={{ padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: 12 }}>
          <SL>Novo registo manual</SL>
          <div className="field">
            <label>Funcionário</label>
            <select value={newEmpId} onChange={e => setNewEmpId(e.target.value)} className="input">
              <option value="">Selecionar...</option>
              {employees.map(e => <option key={e.id} value={e.id}>{e.name}</option>)}
            </select>
          </div>
          <div className="form-grid-2">
            <div className="field">
              <label>Tipo</label>
              <select value={newType} onChange={e => setNewType(e.target.value)} className="input">
                <option value="entrada">Entrada</option>
                <option value="saída">Saída</option>
                <option value="inicio_almoco">Almoço</option>
                <option value="fim_almoco">Ret. Almoço</option>
                <option value="pausa_cafe">Café</option>
                <option value="retorno_cafe">Ret. Café</option>
              </select>
            </div>
            <div className="field">
              <label>Data e hora</label>
              <input type="datetime-local" value={newTs} onChange={e => setNewTs(e.target.value)} className="input" />
            </div>
          </div>
          {newErr && <div className="alert-inline err">{newErr}</div>}
          {newOk  && <div className="alert-inline ok">{newOk}</div>}
          <button onClick={handleAdd} disabled={newSaving} className="btn primary" style={{ width: '100%', justifyContent: 'center' }}>
            {newSaving ? 'A adicionar...' : '+ Adicionar registo'}
          </button>
        </div>
      </div>
    </>
  )
}
