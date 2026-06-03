'use client'

import { useState, Fragment } from 'react'
import type { Employee } from '@/lib/types'
import { avatarInitials } from '@/lib/utils'
import { empColor } from '../../_lib/helpers'
import { useLang } from '@/lib/LangContext'
import { IconUserPlus, IconSearch } from '../icons'

function EmployeeSettings({ emp, onDone }: { emp: Employee; onDone: () => void }) {
  const { t } = useLang()
  const [name, setName] = useState(emp.name)
  const [username, setUsername] = useState(emp.username)
  const [email, setEmail] = useState(emp.email ?? '')
  const [role, setRole] = useState<'employee' | 'manager' | 'admin'>(emp.role)
  const [workdayHours, setWorkdayHours] = useState(String(emp.workday_hours))
  const [lunchMin, setLunchMin] = useState(String(emp.lunch_break_minutes))
  const [rate, setRate] = useState(emp.hourly_rate != null ? String(emp.hourly_rate) : '')
  const [geoMode, setGeoMode] = useState<'required' | 'optional' | 'disabled'>(emp.geo_mode ?? 'optional')
  const [expectedStart, setExpectedStart] = useState(emp.expected_start ?? '')
  const [expectedEnd, setExpectedEnd] = useState(emp.expected_end ?? '')
  const [shiftStart, setShiftStart] = useState(emp.shift_start ?? '00:00')
  const [newPassword, setNewPassword] = useState('')
  const [showNewPwd, setShowNewPwd] = useState(false)
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
    if (expectedStart !== (emp.expected_start ?? '')) body.expected_start = expectedStart || null
    if (expectedEnd !== (emp.expected_end ?? '')) body.expected_end = expectedEnd || null
    if (shiftStart !== (emp.shift_start ?? '00:00')) body.shift_start = shiftStart
    if (newPassword) body.new_password = newPassword
    const res = await fetch(`/api/employees/${emp.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
    const data = await res.json()
    if (!res.ok) { setErr(data.error ?? t('emp.error_save')); setSaving(false); return }
    setOk(newPassword ? t('emp.saved_pwd') : t('emp.saved'))
    setNewPassword('')
    setSaving(false)
    setTimeout(() => onDone(), 1200)
  }

  return (
    <div style={{ marginTop: 12, paddingTop: 12, borderTop: '1px solid var(--border)', display: 'flex', flexDirection: 'column', gap: 10 }}>
      <div className="field">
        <label>{t('emp.full_name')}</label>
        <input value={name} onChange={e => setName(e.target.value)} placeholder="ex: Maria Silva" className="input" />
      </div>
      <div className="form-grid-2">
        <div className="field">
          <label>{t('emp.username_label')}</label>
          <input value={username} onChange={e => setUsername(e.target.value)} placeholder="ex: maria.silva" className="input" />
        </div>
        <div className="field">
          <label>{t('emp.profile')}</label>
          <select value={role} onChange={e => setRole(e.target.value as 'employee' | 'manager' | 'admin')} className="input">
            <option value="employee">{t('auth.role.employee')}</option>
            <option value="manager">{t('auth.role.manager')}</option>
            <option value="admin">{t('auth.role.admin')}</option>
          </select>
        </div>
      </div>
      <div className="field">
        <label>{t('emp.email_optional')}</label>
        <input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="maria@empresa.com" className="input" />
      </div>
      <div className="form-grid-3">
        <div className="field">
          <label>{t('emp.workday')}</label>
          <select value={workdayHours} onChange={e => setWorkdayHours(e.target.value)} className="input">
            {[4, 5, 6, 6.5, 7, 7.5, 8, 8.5, 9, 10].map(h => <option key={h} value={h}>{h}h</option>)}
          </select>
        </div>
        <div className="field">
          <label>{t('emp.lunch_label')}</label>
          <select value={lunchMin} onChange={e => setLunchMin(e.target.value)} className="input">
            <option value="0">{t('emp.lunch.none')}</option>
            <option value="15">{t('emp.lunch.15')}</option>
            <option value="30">{t('emp.lunch.30')}</option>
            <option value="45">{t('emp.lunch.45')}</option>
            <option value="60">{t('emp.lunch.60')}</option>
          </select>
        </div>
        <div className="field">
          <label>{t('emp.hourly_rate')}</label>
          <input type="number" min="0" step="0.01" value={rate} onChange={e => setRate(e.target.value)} placeholder="0,00" className="input" />
        </div>
      </div>
      <div className="field">
        <label>{t('emp.geo_label')}</label>
        <select value={geoMode} onChange={e => setGeoMode(e.target.value as 'required' | 'optional' | 'disabled')} className="input">
          <option value="optional">{t('emp.geo.optional')}</option>
          <option value="required">{t('emp.geo.required')}</option>
          <option value="disabled">{t('emp.geo.disabled')}</option>
        </select>
      </div>
      <div style={{ borderTop: '1px solid var(--border)', paddingTop: 10, marginTop: 2 }}>
        <div style={{ fontSize: 11, fontWeight: 600, letterSpacing: '0.05em', textTransform: 'uppercase', color: 'var(--fg-subtle)', marginBottom: 8 }}>{t('emp.schedule')}</div>
        <div className="form-grid-2">
          <div className="field">
            <label>{t('emp.expected_start')}</label>
            <input type="time" value={expectedStart} onChange={e => setExpectedStart(e.target.value)} className="input" />
          </div>
          <div className="field">
            <label>{t('emp.expected_end')}</label>
            <input type="time" value={expectedEnd} onChange={e => setExpectedEnd(e.target.value)} className="input" />
          </div>
        </div>
        <div className="field">
          <label>{t('emp.shift_start')}</label>
          <input type="time" value={shiftStart} onChange={e => setShiftStart(e.target.value)} className="input" />
          <div style={{ fontSize: 10, color: 'var(--fg-subtle)', marginTop: 3 }}>{t('emp.shift_start.hint')}</div>
          {(() => {
            const [h] = shiftStart.split(':').map(Number)
            return h > 0 && h < 20
              ? <div className="alert-inline warn" style={{ fontSize: 11, marginTop: 6, padding: '6px 10px' }}>{t('emp.shift_start.warn')}</div>
              : null
          })()}
        </div>
      </div>
      <div className="field">
        <label>{t('emp.new_pwd')}</label>
        <div style={{ position: 'relative' }}>
          <input type={showNewPwd ? 'text' : 'password'} value={newPassword} onChange={e => setNewPassword(e.target.value)} placeholder="Mín. 6 caracteres" className="input" style={{ paddingRight: 40 }} />
          <button type="button" onClick={() => setShowNewPwd(v => !v)} tabIndex={-1} style={{ position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--fg-muted)', fontSize: 16, padding: 0, lineHeight: 1 }}>
            {showNewPwd ? '🙈' : '👁'}
          </button>
        </div>
      </div>
      {err && <div className="alert-inline err">{err}</div>}
      {ok  && <div className="alert-inline ok">{ok}</div>}
      <div style={{ display: 'flex', gap: 8 }}>
        <button onClick={handleSave} disabled={saving} className="btn primary" style={{ flex: 1, justifyContent: 'center' }}>
          {saving ? t('emp.saving') : t('common.save')}
        </button>
        <button onClick={onDone} className="btn ghost">{t('common.cancel')}</button>
      </div>
    </div>
  )
}

export function FuncionariosTab({ employees, onRefresh }: { employees: Employee[]; onRefresh: () => void }) {
  const { t } = useLang()
  const [name, setName] = useState('')
  const [username, setUsername] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [role, setRole] = useState<'employee' | 'manager' | 'admin'>('employee')
  const [workdayHours, setWorkdayHours] = useState('8')
  const [lunchMin, setLunchMin] = useState('60')
  const [rate, setRate] = useState('')
  const [err, setErr] = useState('')
  const [ok, setOk] = useState('')
  const [loading, setLoading] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [lockingId, setLockingId] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [roleFilter, setRoleFilter] = useState<'all' | 'admin' | 'manager' | 'employee'>('all')
  const [activeFilter, setActiveFilter] = useState<'active' | 'inactive' | 'all'>('active')

  const handleToggleLock = async (emp: Employee) => {
    setLockingId(emp.id)
    try {
      const res = await fetch(`/api/employees/${emp.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ lock_profile: !emp.lock_profile }),
      })
      if (res.ok) onRefresh()
    } catch { /* non-fatal */ }
    finally { setLockingId(null) }
  }

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault(); setErr(''); setOk(''); setLoading(true)
    const res = await fetch('/api/employees', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, username, email: email || null, password, role, workday_hours: workdayHours, lunch_break_minutes: lunchMin, hourly_rate: rate || null }),
    })
    const data = await res.json()
    if (!res.ok) { setErr(data.error); setLoading(false); return }
    setOk(t('emp.added_ok').replace('{name}', name))
    setName(''); setUsername(''); setEmail(''); setPassword(''); setRole('employee')
    setWorkdayHours('8'); setLunchMin('60'); setRate('')
    setLoading(false); onRefresh()
  }

  const handleRemove = async (id: string, empName: string) => {
    if (!confirm(t('emp.deactivate_confirm').replace('{name}', empName))) return
    const res = await fetch(`/api/employees/${id}`, { method: 'DELETE' })
    if (!res.ok) { const data = await res.json(); setErr(data.error ?? t('emp.error_remove')); return }
    onRefresh()
  }

  const filtered = employees.filter(e => {
    if (activeFilter === 'active' && e.active === false) return false
    if (activeFilter === 'inactive' && e.active !== false) return false
    if (roleFilter !== 'all' && e.role !== roleFilter) return false
    const q = search.trim().toLowerCase()
    if (q && !e.name.toLowerCase().includes(q) && !e.username.toLowerCase().includes(q) && !(e.email ?? '').toLowerCase().includes(q)) return false
    return true
  })
  const activeCount = employees.filter(e => e.active !== false).length
  const inactiveCount = employees.length - activeCount

  return (
    <>
      {/* Page header */}
      <div className="page-head">
        <div>
          <div className="page-title">{t('tab.funcionarios')}</div>
          <div className="page-sub">{activeCount} ativos · {inactiveCount} inativos</div>
        </div>
        <div className="page-actions">
          <button className="btn primary" onClick={() => document.getElementById('emp-add-form')?.scrollIntoView({ behavior: 'smooth' })}>
            <IconUserPlus size={13}/> {t('emp.add_btn')}
          </button>
        </div>
      </div>

      {/* Filter bar */}
      <div className="card">
        <div style={{ padding: '12px 16px', display: 'flex', flexWrap: 'wrap', gap: 10, alignItems: 'center' }}>
          <div style={{ position: 'relative', flex: '1 1 220px', maxWidth: 320 }}>
            <span style={{ position: 'absolute', left: 8, top: '50%', transform: 'translateY(-50%)', color: 'var(--fg-subtle)', display: 'inline-flex' }}>
              <IconSearch size={13} />
            </span>
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder={t('emp.search_placeholder')}
              className="input search"
              style={{ width: '100%' }}
            />
          </div>
          <select value={roleFilter} onChange={e => setRoleFilter(e.target.value as 'all' | 'admin' | 'manager' | 'employee')} className="input" style={{ width: 'auto' }}>
            <option value="all">Todos os cargos</option>
            <option value="admin">Administradores</option>
            <option value="manager">Gestores</option>
            <option value="employee">Funcionários</option>
          </select>
          <div className="seg">
            <button className={activeFilter === 'active' ? 'active' : ''} onClick={() => setActiveFilter('active')}>Ativos</button>
            <button className={activeFilter === 'inactive' ? 'active' : ''} onClick={() => setActiveFilter('inactive')}>Inativos</button>
            <button className={activeFilter === 'all' ? 'active' : ''} onClick={() => setActiveFilter('all')}>Todos</button>
          </div>
        </div>
      </div>

      {err && <div className="alert-inline err">{err}</div>}

      {/* Employee table */}
      <div className="card">
        {filtered.length === 0 ? (
          <div className="empty">
            <div className="title">Nenhum funcionário encontrado</div>
            <div className="desc">Tente ajustar os filtros ou a busca.</div>
          </div>
        ) : (
          <table className="table">
            <thead>
              <tr>
                <th>Nome</th>
                <th>Cargo</th>
                <th className="right">Jornada</th>
                <th className="right">Almoço</th>
                <th className="right">Valor/h</th>
                <th>Status</th>
                <th style={{ width: 130 }}></th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(emp => (
                <Fragment key={emp.id}>
                  <tr className={editingId === emp.id ? 'selected' : ''}>
                    <td>
                      <div className="cell-emp">
                        <div className={`avatar size-28 av-c${empColor(emp.id)}`}>{avatarInitials(emp.name)}</div>
                        <div className="cell-emp-info">
                          <div className="cell-emp-name">{emp.name}</div>
                          <div className="cell-emp-sub">@{emp.username}{emp.email ? ` · ${emp.email}` : ''}</div>
                        </div>
                      </div>
                    </td>
                    <td>
                      {emp.role === 'admin' && <span className="chip accent" style={{ fontSize: 10 }}>Admin</span>}
                      {emp.role === 'manager' && <span className="chip accent" style={{ fontSize: 10 }}>{t('auth.role.manager')}</span>}
                      {emp.role === 'employee' && <span className="muted" style={{ fontSize: 12 }}>{t('auth.role.employee')}</span>}
                    </td>
                    <td className="right tnum">{emp.workday_hours}h</td>
                    <td className="right tnum muted">{emp.lunch_break_minutes > 0 ? `${emp.lunch_break_minutes}min` : '—'}</td>
                    <td className="right tnum">{emp.hourly_rate != null ? `€${Number(emp.hourly_rate).toFixed(2)}` : <span className="muted">—</span>}</td>
                    <td>
                      {emp.active === false
                        ? <span className="chip outline" style={{ fontSize: 10 }}>Inativo</span>
                        : <span className="chip success" style={{ fontSize: 10 }}><span className="dot"/>Ativo</span>}
                      {emp.lock_profile && <span className="chip danger" style={{ fontSize: 10, marginLeft: 4 }}>{t('emp.profile_locked')}</span>}
                    </td>
                    <td>
                      <div style={{ display: 'flex', gap: 4, justifyContent: 'flex-end' }}>
                        <button
                          onClick={() => handleToggleLock(emp)}
                          disabled={lockingId === emp.id}
                          className={`btn ghost sm icon${emp.lock_profile ? ' danger' : ''}`}
                          title={emp.lock_profile ? t('emp.unlock_profile') : t('emp.lock_profile')}
                          style={{ opacity: lockingId === emp.id ? 0.5 : 1 }}
                        >
                          {emp.lock_profile ? '🔒' : '🔓'}
                        </button>
                        <button onClick={() => setEditingId(editingId === emp.id ? null : emp.id)} className="btn ghost sm icon" title="Configurações">⚙</button>
                        {emp.role !== 'admin' && (
                          <button onClick={() => handleRemove(emp.id, emp.name)} className="btn danger sm">{t('emp.remove')}</button>
                        )}
                      </div>
                    </td>
                  </tr>
                  {editingId === emp.id && (
                    <tr>
                      <td colSpan={7} style={{ padding: '0 16px 16px', borderBottom: '1px solid var(--border)' }}>
                        <EmployeeSettings emp={emp} onDone={() => { setEditingId(null); onRefresh() }} />
                      </td>
                    </tr>
                  )}
                </Fragment>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <div className="card" id="emp-add-form">
        <div className="card-head">
          <div className="card-title">{t('emp.add_new')}</div>
        </div>
        <div className="card-body">
          <form onSubmit={handleAdd} style={{ display: 'flex', flexDirection: 'column', gap: 12, marginTop: 4 }}>
            <div className="form-grid-2">
              <div className="field"><label>{t('emp.name')}</label><input value={name} onChange={e => setName(e.target.value)} placeholder="Maria Silva" className="input" required /></div>
              <div className="field"><label>{t('emp.username_label')}</label><input value={username} onChange={e => setUsername(e.target.value)} placeholder="maria.silva" className="input" required /></div>
            </div>
            <div className="field">
              <label>{t('emp.email_optional')}</label>
              <input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="maria@empresa.com" className="input" />
            </div>
            <div className="form-grid-2">
              <div className="field">
                <label>{t('auth.password')}</label>
                <div style={{ position: 'relative' }}>
                  <input type={showPassword ? 'text' : 'password'} value={password} onChange={e => setPassword(e.target.value)} placeholder="Mín. 6 chars" className="input" style={{ paddingRight: 40 }} required />
                  <button type="button" onClick={() => setShowPassword(v => !v)} tabIndex={-1} style={{ position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--fg-muted)', fontSize: 16, padding: 0, lineHeight: 1 }}>
                    {showPassword ? '🙈' : '👁'}
                  </button>
                </div>
              </div>
              <div className="field">
                <label>{t('emp.profile')}</label>
                <select value={role} onChange={e => setRole(e.target.value as 'employee' | 'manager' | 'admin')} className="input">
                  <option value="employee">{t('auth.role.employee')}</option>
                  <option value="manager">{t('auth.role.manager')}</option>
                  <option value="admin">{t('auth.role.admin')}</option>
                </select>
              </div>
            </div>
            <div className="form-grid-3">
              <div className="field">
                <label>{t('emp.workday')}</label>
                <select value={workdayHours} onChange={e => setWorkdayHours(e.target.value)} className="input">
                  {[4, 5, 6, 6.5, 7, 7.5, 8, 8.5, 9, 10].map(h => <option key={h} value={h}>{h}h</option>)}
                </select>
              </div>
              <div className="field">
                <label>{t('emp.lunch_label')}</label>
                <select value={lunchMin} onChange={e => setLunchMin(e.target.value)} className="input">
                  <option value="0">{t('emp.lunch.none')}</option>
                  <option value="15">{t('emp.lunch.15')}</option>
                  <option value="30">{t('emp.lunch.30')}</option>
                  <option value="45">{t('emp.lunch.45')}</option>
                  <option value="60">{t('emp.lunch.60')}</option>
                </select>
              </div>
              <div className="field">
                <label>{t('emp.hourly_rate')}</label>
                <input type="number" min="0" step="0.01" value={rate} onChange={e => setRate(e.target.value)} placeholder="Opcional" className="input" />
              </div>
            </div>
            {err && <div className="alert-inline err">{err}</div>}
            {ok  && <div className="alert-inline ok">{ok}</div>}
            <button type="submit" disabled={loading} className="btn primary" style={{ width: '100%', justifyContent: 'center' }}>
              {loading ? t('emp.adding') : t('emp.add_btn')}
            </button>
          </form>
        </div>
      </div>
    </>
  )
}
