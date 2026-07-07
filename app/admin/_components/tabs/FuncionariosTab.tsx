'use client'

import { useState, Fragment, useEffect } from 'react'
import type { Employee } from '@/lib/types'
import { avatarInitials } from '@/lib/utils'
import { empColor } from '../../_lib/helpers'
import { useLang } from '@/lib/LangContext'
import { IconUserPlus, IconSearch, IconDownload } from '../icons'
import { ImportEmployeesCard } from './ImportEmployeesCard'
import { Modal } from '../Modal'

interface ShiftTemplate {
  id: string
  name: string
  workday_hours: number
  lunch_break_minutes: number
  expected_start: string | null
  expected_end: string | null
  shift_start: string
}

function ShiftTemplatesCard({ employees }: { employees: Employee[] }) {
  const { t } = useLang()
  const [templates, setTemplates] = useState<ShiftTemplate[]>([])
  const [loading, setLoading] = useState(true)
  const [name, setName] = useState('')
  const [workdayHours, setWorkdayHours] = useState('8')
  const [lunchMin, setLunchMin] = useState('60')
  const [expectedStart, setExpectedStart] = useState('')
  const [expectedEnd, setExpectedEnd] = useState('')
  const [shiftStart, setShiftStart] = useState('00:00')
  const [creating, setCreating] = useState(false)
  const [showCreate, setShowCreate] = useState(false)
  const [applyModal, setApplyModal] = useState<ShiftTemplate | null>(null)
  const [selectedEmps, setSelectedEmps] = useState<string[]>([])
  const [applying, setApplying] = useState(false)
  const [applyMsg, setApplyMsg] = useState<{ ok: boolean; text: string } | null>(null)
  const [err, setErr] = useState('')

  const load = async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/shift-templates')
      if (res.ok) setTemplates(await res.json())
    } catch { /* silent */ }
    finally { setLoading(false) }
  }

  useEffect(() => { load() }, [])

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault(); setErr(''); setCreating(true)
    try {
      const res = await fetch('/api/shift-templates', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, workday_hours: workdayHours, lunch_break_minutes: lunchMin, expected_start: expectedStart || null, expected_end: expectedEnd || null, shift_start: shiftStart }),
      })
      if (res.ok) {
        setName(''); setExpectedStart(''); setExpectedEnd(''); setShiftStart('00:00')
        setShowCreate(false)
        await load()
      } else {
        const d = await res.json(); setErr(d.error ?? t('tmpl.err.create'))
      }
    } catch { setErr(t('error.connect')) }
    finally { setCreating(false) }
  }

  const handleDelete = async (id: string) => {
    if (!confirm(t('tmpl.del_confirm'))) return
    await fetch(`/api/shift-templates?id=${id}`, { method: 'DELETE' })
    setTemplates(prev => prev.filter(t => t.id !== id))
  }

  const handleApply = async () => {
    if (!applyModal || !selectedEmps.length) return
    setApplying(true); setApplyMsg(null)
    try {
      const res = await fetch('/api/shift-templates/apply', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ templateId: applyModal.id, employeeIds: selectedEmps }),
      })
      const d = await res.json()
      if (res.ok) setApplyMsg({ ok: true, text: t('tmpl.applied').replace('{n}', String(d.applied)) })
      else setApplyMsg({ ok: false, text: d.error ?? t('tmpl.err.apply') })
    } catch { setApplyMsg({ ok: false, text: t('error.connect') }) }
    finally { setApplying(false) }
  }

  return (
    <>
      {applyModal && (
        <Modal title={t('tmpl.apply_title').replace('{name}', applyModal.name)} onClose={() => { setApplyModal(null); setSelectedEmps([]); setApplyMsg(null) }} width={460}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div style={{ fontSize: 12, color: 'var(--fg-muted)' }}>
              {t('tmpl.modal_hint')}
              <strong> {applyModal.workday_hours}h/dia, {applyModal.lunch_break_minutes}min almoço</strong>
              {applyModal.expected_start && `, entrada ${applyModal.expected_start}`}
              {applyModal.expected_end && `, saída ${applyModal.expected_end}`}
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4, maxHeight: 260, overflowY: 'auto' }}>
              {employees.filter(e => e.active !== false).map(emp => (
                <label key={emp.id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 8px', borderRadius: 'var(--r-sm)', cursor: 'pointer', background: selectedEmps.includes(emp.id) ? 'var(--accent-soft, rgba(99,102,241,0.1))' : 'transparent' }}>
                  <input
                    type="checkbox"
                    checked={selectedEmps.includes(emp.id)}
                    onChange={e => setSelectedEmps(prev => e.target.checked ? [...prev, emp.id] : prev.filter(id => id !== emp.id))}
                  />
                  <span style={{ fontSize: 13 }}>{emp.name}</span>
                </label>
              ))}
            </div>
            <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
              <button className="btn ghost sm" style={{ fontSize: 11 }} onClick={() => setSelectedEmps(employees.filter(e => e.active !== false).map(e => e.id))}>{t('tmpl.select_all')}</button>
              <button className="btn ghost sm" style={{ fontSize: 11 }} onClick={() => setSelectedEmps([])}>{t('tmpl.clear')}</button>
            </div>
            {applyMsg && <div className={`alert-inline ${applyMsg.ok ? 'ok' : 'err'}`}>{applyMsg.text}</div>}
            <div style={{ display: 'flex', gap: 8 }}>
              <button className="btn primary" disabled={applying || !selectedEmps.length} onClick={handleApply} style={{ flex: 1, justifyContent: 'center' }}>
                {applying ? t('tmpl.applying') : t('tmpl.apply_to').replace('{n}', String(selectedEmps.length))}
              </button>
            </div>
          </div>
        </Modal>
      )}

      <div className="card">
        <div className="card-head">
          <div className="card-title">{t('tmpl.title')}</div>
          <button className="btn ghost sm" onClick={() => setShowCreate(v => !v)}>
            {showCreate ? t('common.cancel') : t('tmpl.new')}
          </button>
        </div>

        {showCreate && (
          <div className="card-body" style={{ borderBottom: '1px solid var(--divider)' }}>
            <form onSubmit={handleCreate} style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <div className="form-grid-2">
                <div className="field">
                  <label>{t('tmpl.name_label')}</label>
                  <input value={name} onChange={e => setName(e.target.value)} placeholder={t('tmpl.name_ph')} className="input" required />
                </div>
                <div className="field">
                  <label>{t('emp.workday')}</label>
                  <select value={workdayHours} onChange={e => setWorkdayHours(e.target.value)} className="input">
                    {[4, 5, 6, 6.5, 7, 7.5, 8, 8.5, 9, 10].map(h => <option key={h} value={h}>{h}h</option>)}
                  </select>
                </div>
              </div>
              <div className="form-grid-2">
                <div className="field">
                  <label>{t('tmpl.lunch_label')}</label>
                  <select value={lunchMin} onChange={e => setLunchMin(e.target.value)} className="input">
                    <option value="0">{t('tmpl.no_lunch')}</option>
                    <option value="15">15 min</option>
                    <option value="30">30 min</option>
                    <option value="45">45 min</option>
                    <option value="60">60 min</option>
                  </select>
                </div>
                <div className="field">
                  <label>{t('tmpl.shift_label')}</label>
                  <input type="time" value={shiftStart} onChange={e => setShiftStart(e.target.value)} className="input" />
                </div>
              </div>
              <div className="form-grid-2">
                <div className="field">
                  <label>{t('tmpl.exp_in_label')}</label>
                  <input type="time" value={expectedStart} onChange={e => setExpectedStart(e.target.value)} className="input" />
                </div>
                <div className="field">
                  <label>{t('tmpl.exp_out_label')}</label>
                  <input type="time" value={expectedEnd} onChange={e => setExpectedEnd(e.target.value)} className="input" />
                </div>
              </div>
              {err && <div className="alert-inline err">{err}</div>}
              <button type="submit" disabled={creating} className="btn primary" style={{ alignSelf: 'flex-start' }}>
                {creating ? t('tmpl.creating') : t('tmpl.create_btn')}
              </button>
            </form>
          </div>
        )}

        <div className="card-body">
          {loading && <div style={{ fontSize: 12, color: 'var(--fg-muted)' }}>{t('common.loading')}</div>}
          {!loading && templates.length === 0 && (
            <div style={{ fontSize: 12, color: 'var(--fg-muted)' }}>{t('tmpl.empty')}</div>
          )}
          {!loading && templates.length > 0 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {templates.map(tmpl => (
                <div key={tmpl.id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 0', borderBottom: '1px solid var(--divider)' }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 13, fontWeight: 600 }}>{tmpl.name}</div>
                    <div style={{ fontSize: 11, color: 'var(--fg-muted)', marginTop: 2 }}>
                      {tmpl.workday_hours}h · {tmpl.lunch_break_minutes}min almoço
                      {tmpl.expected_start && ` · entrada ${tmpl.expected_start}`}
                      {tmpl.expected_end && ` · saída ${tmpl.expected_end}`}
                    </div>
                  </div>
                  <button className="btn ghost sm" onClick={() => { setApplyModal(tmpl); setSelectedEmps([]); setApplyMsg(null) }}>{t('tmpl.apply_btn')}</button>
                  <button className="btn danger sm" onClick={() => handleDelete(tmpl.id)}>{t('common.delete')}</button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </>
  )
}

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
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
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
      <div style={{ borderTop: '1px solid var(--divider)', paddingTop: 10, marginTop: 2 }}>
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
      <button
        onClick={async () => {
          if (!confirm(`Resetar a verificação em duas etapas de ${emp.name}? A pessoa volta a entrar só com a senha.`)) return
          const res = await fetch(`/api/employees/${emp.id}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ reset_totp: true }),
          })
          if (res.ok) setOk('2FA resetada — login volta a pedir apenas a senha.')
          else { const d = await res.json(); setErr(d.error ?? 'Erro ao resetar 2FA') }
        }}
        className="btn ghost sm"
        style={{ alignSelf: 'flex-start', color: 'var(--fg-muted)' }}
        title="Use quando o funcionário perdeu o telefone com o aplicativo autenticador"
      >
        Resetar 2FA (telefone perdido)
      </button>
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
  const [showImport, setShowImport] = useState(false)
  const [showAdd, setShowAdd] = useState(false)

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
    setTimeout(() => { setOk(''); setShowAdd(false) }, 1500)
  }

  const handleRemove = async (id: string, empName: string) => {
    if (!confirm(t('emp.deactivate_confirm').replace('{name}', empName))) return
    const res = await fetch(`/api/employees/${id}`, { method: 'DELETE' })
    if (!res.ok) { const data = await res.json(); setErr(data.error ?? t('emp.error_remove')); return }
    onRefresh()
  }

  const handleRestore = async (id: string) => {
    setErr('')
    const res = await fetch(`/api/employees/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ active: true }),
    })
    if (!res.ok) { const data = await res.json(); setErr(data.error ?? 'Erro ao restaurar'); return }
    onRefresh()
  }

  const editingEmp = editingId ? employees.find(e => e.id === editingId) ?? null : null

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
      {/* Edit employee modal */}
      {editingEmp && (
        <Modal
          title={`Configurações — ${editingEmp.name}`}
          onClose={() => setEditingId(null)}
          width={540}
        >
          <EmployeeSettings emp={editingEmp} onDone={() => { setEditingId(null); onRefresh() }} />
        </Modal>
      )}

      {/* Add employee modal */}
      {showAdd && (
        <Modal title={t('emp.add_new')} onClose={() => { setShowAdd(false); setErr(''); setOk('') }} width={560}>
          <form onSubmit={handleAdd} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
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
        </Modal>
      )}

      {/* Page header */}
      <div className="page-head">
        <div>
          <div className="page-title">{t('tab.funcionarios')}</div>
          <div className="page-sub">{activeCount} ativos · {inactiveCount} inativos</div>
        </div>
        <div className="page-actions">
          <button className="btn ghost" onClick={() => setShowImport(v => !v)}>
            <IconDownload size={13}/> Importar CSV
          </button>
          <button className="btn primary" onClick={() => setShowAdd(true)}>
            <IconUserPlus size={13}/> {t('emp.add_btn')}
          </button>
        </div>
      </div>

      {showImport && <ImportEmployeesCard onDone={onRefresh} onClose={() => setShowImport(false)} />}

      {/* Shift templates */}
      <ShiftTemplatesCard employees={employees} />

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
                <tr key={emp.id} className={editingId === emp.id ? 'selected' : ''}>
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
                      {emp.active === false ? (
                        <button onClick={() => handleRestore(emp.id)} className="btn ghost sm" title="Reativa o funcionário com todo o histórico preservado">
                          ↺ Restaurar
                        </button>
                      ) : (
                        <>
                          <button
                            onClick={() => handleToggleLock(emp)}
                            disabled={lockingId === emp.id}
                            className={`btn ghost sm icon${emp.lock_profile ? ' danger' : ''}`}
                            title={emp.lock_profile ? t('emp.unlock_profile') : t('emp.lock_profile')}
                            style={{ opacity: lockingId === emp.id ? 0.5 : 1 }}
                          >
                            {emp.lock_profile ? '🔒' : '🔓'}
                          </button>
                          <button onClick={() => setEditingId(emp.id)} className="btn ghost sm icon" title="Configurações">⚙</button>
                          {emp.role !== 'admin' && (
                            <button onClick={() => handleRemove(emp.id, emp.name)} className="btn danger sm">{t('emp.remove')}</button>
                          )}
                        </>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </>
  )
}
