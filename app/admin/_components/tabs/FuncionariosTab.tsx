'use client'

import { useState } from 'react'
import type { Employee } from '@/lib/types'
import { avatarInitials } from '@/lib/utils'
import { empColor, SL } from '../../_lib/helpers'

function EmployeeSettings({ emp, onDone }: { emp: Employee; onDone: () => void }) {
  const [name, setName] = useState(emp.name)
  const [username, setUsername] = useState(emp.username)
  const [email, setEmail] = useState(emp.email ?? '')
  const [role, setRole] = useState<'employee' | 'manager' | 'admin'>(emp.role)
  const [workdayHours, setWorkdayHours] = useState(String(emp.workday_hours))
  const [lunchMin, setLunchMin] = useState(String(emp.lunch_break_minutes))
  const [rate, setRate] = useState(emp.hourly_rate != null ? String(emp.hourly_rate) : '')
  const [geoMode, setGeoMode] = useState<'required' | 'optional' | 'disabled'>(emp.geo_mode ?? 'optional')
  const [newPassword, setNewPassword] = useState('')
  const [err, setErr] = useState('')
  const [ok, setOk] = useState('')
  const [saving, setSaving] = useState(false)

  const handleSave = async () => {
    setSaving(true); setErr(''); setOk('')
    const body: Record<string, unknown> = { workday_hours: workdayHours, lunch_break_minutes: lunchMin, hourly_rate: rate }
    if (name !== emp.name) body.name = name
    if (username !== emp.username) body.username = username
    if (email !== (emp.email ?? '')) body.email = email || null
    if (role !== emp.role) body.role = role
    if (geoMode !== (emp.geo_mode ?? 'optional')) body.geo_mode = geoMode
    if (newPassword) body.new_password = newPassword
    const res = await fetch(`/api/employees/${emp.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
    const data = await res.json()
    if (!res.ok) { setErr(data.error ?? 'Erro ao salvar.'); setSaving(false); return }
    setOk(newPassword ? 'Configurações e senha atualizadas!' : 'Configurações salvas!')
    setNewPassword('')
    setSaving(false)
    setTimeout(() => onDone(), 1200)
  }

  return (
    <div style={{ marginTop: 12, paddingTop: 12, borderTop: '1px solid var(--border)', display: 'flex', flexDirection: 'column', gap: 10 }}>
      <div className="field">
        <label>Nome completo</label>
        <input value={name} onChange={e => setName(e.target.value)} placeholder="ex: Maria Silva" className="input" />
      </div>
      <div className="form-grid-2">
        <div className="field">
          <label>Nome de usuário</label>
          <input value={username} onChange={e => setUsername(e.target.value)} placeholder="ex: maria.silva" className="input" />
        </div>
        <div className="field">
          <label>Perfil</label>
          <select value={role} onChange={e => setRole(e.target.value as 'employee' | 'manager' | 'admin')} className="input">
            <option value="employee">Funcionário</option>
            <option value="manager">Gerente</option>
            <option value="admin">Admin</option>
          </select>
        </div>
      </div>
      <div className="field">
        <label>Email (opcional)</label>
        <input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="maria@empresa.com" className="input" />
      </div>
      <div className="form-grid-3">
        <div className="field">
          <label>Jornada</label>
          <select value={workdayHours} onChange={e => setWorkdayHours(e.target.value)} className="input">
            {[4, 5, 6, 6.5, 7, 7.5, 8, 8.5, 9, 10].map(h => <option key={h} value={h}>{h}h</option>)}
          </select>
        </div>
        <div className="field">
          <label>Almoço</label>
          <select value={lunchMin} onChange={e => setLunchMin(e.target.value)} className="input">
            <option value="0">Sem desconto</option>
            <option value="15">15 min</option>
            <option value="30">30 min</option>
            <option value="45">45 min</option>
            <option value="60">1 hora</option>
          </select>
        </div>
        <div className="field">
          <label>€/hora</label>
          <input type="number" min="0" step="0.01" value={rate} onChange={e => setRate(e.target.value)} placeholder="0,00" className="input" />
        </div>
      </div>
      <div className="field">
        <label>Geolocalização</label>
        <select value={geoMode} onChange={e => setGeoMode(e.target.value as 'required' | 'optional' | 'disabled')} className="input">
          <option value="optional">Opcional (recomendado)</option>
          <option value="required">Obrigatória</option>
          <option value="disabled">Desativada</option>
        </select>
      </div>
      <div className="field">
        <label>Nova senha (deixe em branco para não alterar)</label>
        <input type="password" value={newPassword} onChange={e => setNewPassword(e.target.value)} placeholder="Mín. 6 caracteres" className="input" />
      </div>
      {err && <div className="alert-inline err">{err}</div>}
      {ok  && <div className="alert-inline ok">{ok}</div>}
      <div style={{ display: 'flex', gap: 8 }}>
        <button onClick={handleSave} disabled={saving} className="btn primary" style={{ flex: 1, justifyContent: 'center' }}>
          {saving ? 'Salvando...' : 'Salvar'}
        </button>
        <button onClick={onDone} className="btn ghost">Cancelar</button>
      </div>
    </div>
  )
}

export function FuncionariosTab({ employees, onRefresh }: { employees: Employee[]; onRefresh: () => void }) {
  const [name, setName] = useState('')
  const [username, setUsername] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [role, setRole] = useState<'employee' | 'manager' | 'admin'>('employee')
  const [workdayHours, setWorkdayHours] = useState('8')
  const [lunchMin, setLunchMin] = useState('60')
  const [rate, setRate] = useState('')
  const [err, setErr] = useState('')
  const [ok, setOk] = useState('')
  const [loading, setLoading] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault(); setErr(''); setOk(''); setLoading(true)
    const res = await fetch('/api/employees', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, username, email: email || null, password, role, workday_hours: workdayHours, lunch_break_minutes: lunchMin, hourly_rate: rate || null }),
    })
    const data = await res.json()
    if (!res.ok) { setErr(data.error); setLoading(false); return }
    setOk(`${name} adicionado!`)
    setName(''); setUsername(''); setEmail(''); setPassword(''); setRole('employee')
    setWorkdayHours('8'); setLunchMin('60'); setRate('')
    setLoading(false); onRefresh()
  }

  const handleRemove = async (id: string, empName: string) => {
    if (!confirm(`Desativar ${empName}?`)) return
    const res = await fetch(`/api/employees/${id}`, { method: 'DELETE' })
    if (!res.ok) { const data = await res.json(); setErr(data.error ?? 'Erro ao remover funcionário.'); return }
    onRefresh()
  }

  return (
    <>
      <div className="card">
        <div style={{ padding: '16px 20px' }}>
          <SL>{employees.length} ativo(s)</SL>
          {err && <div className="alert-inline err" style={{ marginBottom: 12 }}>{err}</div>}
          {employees.map(emp => (
            <div key={emp.id} style={{ borderBottom: '1px solid var(--border)', paddingBottom: 12, marginBottom: 12 }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <div className={`avatar size-28 av-c${empColor(emp.id)}`}>{avatarInitials(emp.name)}</div>
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--fg)', display: 'flex', alignItems: 'center', gap: 6 }}>
                      {emp.name}
                      {emp.role === 'admin' && <span className="chip accent" style={{ fontSize: 10 }}>Admin</span>}
                      {emp.role === 'manager' && <span className="chip accent" style={{ fontSize: 10 }}>Gerente</span>}
                    </div>
                    <div style={{ fontSize: 11, color: 'var(--fg-muted)', marginTop: 2 }}>
                      @{emp.username} · {emp.workday_hours}h ·{' '}
                      {emp.lunch_break_minutes > 0 ? `${emp.lunch_break_minutes}min almoço` : 'sem desconto'}
                      {emp.hourly_rate != null && ` · €${Number(emp.hourly_rate).toFixed(2)}/h`}
                      {emp.email && ` · ${emp.email}`}
                    </div>
                  </div>
                </div>
                <div style={{ display: 'flex', gap: 6 }}>
                  <button onClick={() => setEditingId(editingId === emp.id ? null : emp.id)} className="btn ghost sm icon" title="Configurações">⚙</button>
                  {emp.username !== 'admin' && (
                    <button onClick={() => handleRemove(emp.id, emp.name)} className="btn danger sm">Remover</button>
                  )}
                </div>
              </div>
              {editingId === emp.id && (
                <EmployeeSettings emp={emp} onDone={() => { setEditingId(null); onRefresh() }} />
              )}
            </div>
          ))}
        </div>
      </div>

      <div className="card">
        <div style={{ padding: '16px 20px' }}>
          <SL>Novo funcionário</SL>
          <form onSubmit={handleAdd} style={{ display: 'flex', flexDirection: 'column', gap: 12, marginTop: 4 }}>
            <div className="form-grid-2">
              <div className="field"><label>Nome</label><input value={name} onChange={e => setName(e.target.value)} placeholder="Maria Silva" className="input" required /></div>
              <div className="field"><label>Usuário</label><input value={username} onChange={e => setUsername(e.target.value)} placeholder="maria.silva" className="input" required /></div>
            </div>
            <div className="field">
              <label>Email (opcional)</label>
              <input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="maria@empresa.com" className="input" />
            </div>
            <div className="form-grid-2">
              <div className="field"><label>Senha</label><input type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="Mín. 6 chars" className="input" required /></div>
              <div className="field">
                <label>Perfil</label>
                <select value={role} onChange={e => setRole(e.target.value as 'employee' | 'manager' | 'admin')} className="input">
                  <option value="employee">Funcionário</option>
                  <option value="manager">Gerente</option>
                  <option value="admin">Admin</option>
                </select>
              </div>
            </div>
            <div className="form-grid-3">
              <div className="field">
                <label>Jornada</label>
                <select value={workdayHours} onChange={e => setWorkdayHours(e.target.value)} className="input">
                  {[4, 5, 6, 6.5, 7, 7.5, 8, 8.5, 9, 10].map(h => <option key={h} value={h}>{h}h</option>)}
                </select>
              </div>
              <div className="field">
                <label>Almoço</label>
                <select value={lunchMin} onChange={e => setLunchMin(e.target.value)} className="input">
                  <option value="0">Sem desconto</option>
                  <option value="15">15 min</option>
                  <option value="30">30 min</option>
                  <option value="45">45 min</option>
                  <option value="60">1 hora</option>
                </select>
              </div>
              <div className="field">
                <label>€/hora</label>
                <input type="number" min="0" step="0.01" value={rate} onChange={e => setRate(e.target.value)} placeholder="Opcional" className="input" />
              </div>
            </div>
            {err && <div className="alert-inline err">{err}</div>}
            {ok  && <div className="alert-inline ok">{ok}</div>}
            <button type="submit" disabled={loading} className="btn primary" style={{ width: '100%', justifyContent: 'center' }}>
              {loading ? 'Adicionando...' : '+ Adicionar'}
            </button>
          </form>
        </div>
      </div>
    </>
  )
}
