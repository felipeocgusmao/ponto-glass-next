'use client'

import { useState, useEffect, useCallback } from 'react'
import type { Tenant } from '@/lib/types'
import { IconBuilding, IconUserPlus, IconUsers, IconPulse } from '../icons'
import { limitLabel, PLANS } from '@/lib/planLimits'
import { normalizeCustomDomain, slugifyTenantInput } from '@/lib/tenantDomain'
import { Modal } from '../Modal'

type TenantHealth = {
  sem_admin: boolean
  sem_actividade_30d: boolean
  limite_atingido: boolean
  trial_expirado: boolean
}

type TenantRow = Tenant & {
  employee_count: number
  employee_total: number
  record_count: number
  last_punch_at: string | null
  last_login_at: string | null
  trial_days_left: number | null
  trial_ends_at: string | null
  health: TenantHealth
}

type AdminRow = { id: string; name: string; username: string; active: boolean }

const inputStyle = { height: 34 } as const

const ROOT_DOMAIN = process.env.NEXT_PUBLIC_TENANT_ROOT_DOMAIN ?? ''
const DEFAULT_TENANT_ID = '00000000-0000-0000-0000-000000000001'

function tenantUrl(t: { slug: string; domain: string | null }): string {
  if (t.domain) return `https://${t.domain}`
  if (ROOT_DOMAIN) return `https://${t.slug}.${ROOT_DOMAIN}`
  if (typeof window !== 'undefined')
    // No per-tenant host (no custom domain / subdomain): login resolves the
    // company from the ?tenant=<slug> query, so this link works from the main
    // URL. Without the query it would hit the default tenant and the company's
    // admin couldn't sign in.
    return `${window.location.origin}/login?tenant=${encodeURIComponent(t.slug)}`
  return ''
}

function timeAgo(iso: string | null): string {
  if (!iso) return '—'
  const diff = Date.now() - new Date(iso).getTime()
  const m = Math.floor(diff / 60000)
  if (m < 2) return 'agora'
  if (m < 60) return `${m}m atrás`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h}h atrás`
  const d = Math.floor(h / 24)
  return `${d}d atrás`
}

type CreatedTenant = { tenant: TenantRow; adminUsername: string; url: string }

export function EmpresasTab() {
  const [tenants, setTenants] = useState<TenantRow[]>([])
  const [loading, setLoading] = useState(true)
  const [showCreate, setShowCreate] = useState(false)
  const [editing, setEditing] = useState<TenantRow | null>(null)
  const [created, setCreated] = useState<CreatedTenant | null>(null)
  const [copied, setCopied] = useState(false)
  const [err, setErr] = useState('')
  const [ok, setOk] = useState('')
  const [saving, setSaving] = useState(false)
  const [showInactive, setShowInactive] = useState(false)

  // Deactivate confirmation
  const [deactivateTarget, setDeactivateTarget] = useState<TenantRow | null>(null)

  // Delete
  const [deleteTarget, setDeleteTarget] = useState<TenantRow | null>(null)
  const [deleteConfirm, setDeleteConfirm] = useState('')
  const [deleting, setDeleting] = useState(false)

  // Impersonation
  const [impersonating, setImpersonating] = useState<string | null>(null)

  // Company search (filter by name/slug)
  const [search, setSearch] = useState('')

  // Global employee search
  const [globalSearch, setGlobalSearch] = useState('')
  const [globalResults, setGlobalResults] = useState<{ id: string; name: string; username: string; role: string; active: boolean; tenant: { name: string; slug: string } | null }[]>([])
  const [globalSearching, setGlobalSearching] = useState(false)

  // Reset password
  const [resetTarget, setResetTarget] = useState<TenantRow | null>(null)
  const [resetAdmins, setResetAdmins] = useState<AdminRow[]>([])
  const [resetEmployeeId, setResetEmployeeId] = useState('')
  const [resetPassword, setResetPassword] = useState('')
  const [resetting, setResetting] = useState(false)

  // Manage admins
  const [adminsTarget, setAdminsTarget] = useState<TenantRow | null>(null)
  const [adminsList, setAdminsList] = useState<(AdminRow & { role: string })[]>([])
  const [newAdminName, setNewAdminName] = useState('')
  const [newAdminUsername, setNewAdminUsername] = useState('')
  const [newAdminPassword, setNewAdminPassword] = useState('')
  const [newAdminRole, setNewAdminRole] = useState('admin')
  const [creatingAdmin, setCreatingAdmin] = useState(false)
  const [togglingAdmin, setTogglingAdmin] = useState<string | null>(null)

  // Trial management
  const [trialTarget, setTrialTarget] = useState<TenantRow | null>(null)
  const [trialDays, setTrialDays] = useState('14')
  const [savingTrial, setSavingTrial] = useState(false)

  // Export
  const [exporting, setExporting] = useState<string | null>(null)

  // Audit logs
  const [showAudit, setShowAudit] = useState(false)
  const [auditLogs, setAuditLogs] = useState<Record<string, unknown>[]>([])
  const [auditLoading, setAuditLoading] = useState(false)
  const [auditTenant, setAuditTenant] = useState('')

  // Create form
  const [name, setName] = useState('')
  const [slug, setSlug] = useState('')
  const [domain, setDomain] = useState('')
  const [adminName, setAdminName] = useState('')
  const [adminUsername, setAdminUsername] = useState('')
  const [adminPassword, setAdminPassword] = useState('')
  const [workdayHours, setWorkdayHours] = useState('8')
  const [lunchMinutes, setLunchMinutes] = useState('60')

  // Edit form
  const [editName, setEditName] = useState('')
  const [editDomain, setEditDomain] = useState('')
  const [editPlan, setEditPlan] = useState('')

  // Spin-off
  const [showSpinOff, setShowSpinOff] = useState(false)
  const [spName, setSpName] = useState('')
  const [spSlug, setSpSlug] = useState('')
  const [spDomain, setSpDomain] = useState('')
  const [spControllerName, setSpControllerName] = useState('')
  const [spControllerUsername, setSpControllerUsername] = useState('')
  const [spControllerPassword, setSpControllerPassword] = useState('')
  const [spConfirm, setSpConfirm] = useState('')
  const [spinningOff, setSpinningOff] = useState(false)
  const [spinOffResult, setSpinOffResult] = useState<{ tenant: Tenant; controllerUsername: string } | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/tenants')
      if (res.ok) setTenants(await res.json())
    } catch { /* silent */ }
    finally { setLoading(false) }
  }, [])

  useEffect(() => { load() }, [load])

  const flash = (msg: string) => { setOk(msg); setTimeout(() => setOk(''), 3500) }

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true); setErr('')
    try {
      const res = await fetch('/api/tenants', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name, slug: slug.trim().toLowerCase(), domain: domain.trim() || null,
          admin_name: adminName, admin_username: adminUsername, admin_password: adminPassword,
          workday_hours: Number(workdayHours), lunch_break_minutes: Number(lunchMinutes),
        }),
      })
      const data = await res.json()
      if (!res.ok) { setErr(data.error ?? 'Erro ao criar empresa'); return }
      const createdUsername = adminUsername.trim().toLowerCase()
      setName(''); setSlug(''); setDomain(''); setAdminName(''); setAdminUsername(''); setAdminPassword('')
      setWorkdayHours('8'); setLunchMinutes('60')
      setShowCreate(false)
      setCreated({ tenant: data, adminUsername: createdUsername, url: tenantUrl(data) })
      await load()
    } catch { setErr('Erro de conexão') }
    finally { setSaving(false) }
  }

  const handleEdit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!editing) return
    setSaving(true); setErr('')
    try {
      const res = await fetch(`/api/tenants/${editing.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: editName, domain: editDomain.trim() || null, plan: editPlan }),
      })
      const data = await res.json()
      if (!res.ok) { setErr(data.error ?? 'Erro ao atualizar'); return }
      setEditing(null)
      flash('Empresa atualizada.')
      await load()
    } catch { setErr('Erro de conexão') }
    finally { setSaving(false) }
  }

  const confirmToggleActive = async () => {
    if (!deactivateTarget) return
    setSaving(true); setErr('')
    try {
      const res = await fetch(`/api/tenants/${deactivateTarget.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ active: !deactivateTarget.active }),
      })
      const data = await res.json()
      if (!res.ok) { setErr(data.error ?? 'Erro ao atualizar'); return }
      flash(data.active ? `Empresa "${data.name}" reativada.` : `Empresa "${data.name}" desativada.`)
      setDeactivateTarget(null)
      await load()
    } catch { setErr('Erro de conexão') }
    finally { setSaving(false) }
  }

  const handleDelete = async () => {
    if (!deleteTarget || deleteConfirm !== deleteTarget.name) return
    setDeleting(true); setErr('')
    try {
      const res = await fetch(`/api/tenants/${deleteTarget.id}`, { method: 'DELETE' })
      const data = await res.json()
      if (!res.ok) { setErr(data.error ?? 'Erro ao eliminar'); setDeleting(false); return }
      setDeleteTarget(null); setDeleteConfirm('')
      flash(`Empresa "${data.name}" eliminada permanentemente.`)
      await load()
    } catch { setErr('Erro de conexão') }
    finally { setDeleting(false) }
  }

  const handleImpersonate = async (t: TenantRow) => {
    setImpersonating(t.id)
    try {
      const res = await fetch(`/api/tenants/${t.id}/impersonate`, { method: 'POST' })
      if (res.ok) {
        window.location.href = '/admin'
      } else {
        const data = await res.json()
        setErr(data.error ?? 'Erro ao entrar como empresa')
      }
    } catch { setErr('Erro de conexão') }
    finally { setImpersonating(null) }
  }

  const openReset = async (t: TenantRow) => {
    setResetTarget(t); setResetPassword(''); setResetEmployeeId(''); setErr('')
    const res = await fetch(`/api/tenants/${t.id}/reset-admin-password`)
    if (res.ok) {
      const admins = await res.json()
      setResetAdmins(admins)
      if (admins.length > 0) setResetEmployeeId(admins[0].id)
    }
  }

  const handleReset = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!resetTarget) return
    setResetting(true); setErr('')
    try {
      const res = await fetch(`/api/tenants/${resetTarget.id}/reset-admin-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ employee_id: resetEmployeeId, new_password: resetPassword }),
      })
      const data = await res.json()
      if (!res.ok) { setErr(data.error ?? 'Erro ao redefinir senha'); return }
      setResetTarget(null)
      flash('Senha redefinida com sucesso.')
    } catch { setErr('Erro de conexão') }
    finally { setResetting(false) }
  }

  const loadAudit = async (tenantId?: string) => {
    setAuditLoading(true)
    const url = `/api/tenants/audit?limit=50${tenantId ? `&tenant_id=${tenantId}` : ''}`
    const res = await fetch(url)
    if (res.ok) setAuditLogs(await res.json())
    setAuditLoading(false)
  }

  const openAudit = (tenantId = '') => {
    setAuditTenant(tenantId)
    setShowAudit(true)
    loadAudit(tenantId || undefined)
  }

  const copyUrl = async (url: string) => {
    try { await navigator.clipboard.writeText(url); setCopied(true); setTimeout(() => setCopied(false), 1800) }
    catch { /* clipboard may be blocked */ }
  }

  const openEdit = (t: TenantRow) => {
    setEditing(t); setEditName(t.name); setEditDomain(t.domain ?? ''); setEditPlan(t.plan); setErr('')
  }

  const handleSpinOff = async (e: React.FormEvent) => {
    e.preventDefault()
    const defaultTenant = tenants.find(t => t.id === DEFAULT_TENANT_ID)
    if (!defaultTenant || spConfirm !== defaultTenant.name) return
    setSpinningOff(true); setErr('')
    try {
      const res = await fetch(`/api/tenants/${DEFAULT_TENANT_ID}/spin-off`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: spName, slug: spSlug.trim().toLowerCase(), domain: spDomain.trim() || null,
          controller_name: spControllerName, controller_username: spControllerUsername, controller_password: spControllerPassword,
        }),
      })
      const data = await res.json()
      if (!res.ok && res.status !== 207) { setErr(data.error ?? 'Erro ao separar a plataforma'); return }
      setShowSpinOff(false)
      setSpName(''); setSpSlug(''); setSpDomain('')
      setSpControllerName(''); setSpControllerUsername(''); setSpControllerPassword(''); setSpConfirm('')
      setSpinOffResult({ tenant: data.tenant, controllerUsername: data.controllerUsername ?? spControllerUsername.trim().toLowerCase() })
      if (res.status === 207) setErr(data.error)
      await load()
    } catch { setErr('Erro de conexão') }
    finally { setSpinningOff(false) }
  }

  const openAdmins = async (t: TenantRow) => {
    setAdminsTarget(t); setNewAdminName(''); setNewAdminUsername(''); setNewAdminPassword(''); setNewAdminRole('admin'); setErr('')
    const res = await fetch(`/api/tenants/${t.id}/admins`)
    if (res.ok) setAdminsList(await res.json())
  }

  const handleCreateAdmin = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!adminsTarget) return
    setCreatingAdmin(true); setErr('')
    const res = await fetch(`/api/tenants/${adminsTarget.id}/admins`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: newAdminName, username: newAdminUsername, password: newAdminPassword, role: newAdminRole }),
    })
    const data = await res.json()
    if (!res.ok) { setErr(data.error ?? 'Erro ao criar admin'); setCreatingAdmin(false); return }
    setAdminsList(prev => [...prev, data])
    setNewAdminName(''); setNewAdminUsername(''); setNewAdminPassword('')
    setCreatingAdmin(false)
    flash('Admin criado com sucesso.')
  }

  const handleToggleAdmin = async (employeeId: string, active: boolean) => {
    if (!adminsTarget) return
    setTogglingAdmin(employeeId)
    const res = await fetch(`/api/tenants/${adminsTarget.id}/admins`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ employee_id: employeeId, active }),
    })
    if (res.ok) setAdminsList(prev => prev.map(a => a.id === employeeId ? { ...a, active } : a))
    setTogglingAdmin(null)
  }

  const handleSetTrial = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!trialTarget) return
    setSavingTrial(true); setErr('')
    const days = Number(trialDays)
    const trialEndsAt = days > 0
      ? new Date(Date.now() + days * 24 * 60 * 60 * 1000).toISOString()
      : null
    const res = await fetch(`/api/tenants/${trialTarget.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ trial_ends_at: trialEndsAt }),
    })
    if (res.ok) {
      setTrialTarget(null)
      flash(trialEndsAt ? `Trial definido para ${days} dias.` : 'Trial removido.')
      await load()
    }
    setSavingTrial(false)
  }

  const handleExport = async (t: TenantRow) => {
    setExporting(t.id)
    try {
      const res = await fetch(`/api/tenants/${t.id}/export`)
      if (!res.ok) { setErr('Erro ao exportar'); return }
      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `export-${t.slug}-${new Date().toISOString().slice(0, 10)}.json`
      a.click()
      URL.revokeObjectURL(url)
    } catch { setErr('Erro de conexão') }
    finally { setExporting(null) }
  }

  const defaultTenant = tenants.find(t => t.id === DEFAULT_TENANT_ID)
  const filteredTenants = search.trim()
    ? tenants.filter(t => t.name.toLowerCase().includes(search.toLowerCase()) || t.slug.includes(search.toLowerCase()))
    : tenants
  const activeTenants = filteredTenants.filter(t => t.active)
  const inactiveTenants = filteredTenants.filter(t => !t.active)

  const handleGlobalSearch = async (q: string) => {
    setGlobalSearch(q)
    if (q.trim().length < 2) { setGlobalResults([]); return }
    setGlobalSearching(true)
    const res = await fetch(`/api/tenants/search?q=${encodeURIComponent(q)}`)
    if (res.ok) setGlobalResults(await res.json())
    setGlobalSearching(false)
  }

  function HealthBadges({ health, trialDaysLeft }: { health: TenantHealth; trialDaysLeft: number | null }) {
    const issues = []
    if (health.sem_admin) issues.push({ label: 'Sem admin', color: 'var(--danger-fg)' })
    if (health.trial_expirado) issues.push({ label: 'Trial expirado', color: 'var(--danger-fg)' })
    if (health.limite_atingido) issues.push({ label: 'Limite atingido', color: '#d97706' })
    if (health.sem_actividade_30d) issues.push({ label: 'Inactivo 30d', color: '#6b7280' })
    if (trialDaysLeft !== null && trialDaysLeft <= 3) issues.push({ label: `Trial: ${trialDaysLeft}d`, color: '#d97706' })
    if (issues.length === 0) return null
    return (
      <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', marginTop: 4 }}>
        {issues.map(i => (
          <span key={i.label} style={{ fontSize: 10, padding: '1px 6px', borderRadius: 10, background: `color-mix(in srgb, ${i.color} 12%, transparent)`, border: `1px solid color-mix(in srgb, ${i.color} 30%, transparent)`, color: i.color, fontWeight: 600 }}>
            {i.label}
          </span>
        ))}
      </div>
    )
  }

  return (
    <>
      <div className="page-head">
        <div>
          <div className="page-title">Empresas</div>
          <div className="page-sub">
            {activeTenants.length} ativa(s)
            {inactiveTenants.length > 0 && ` · ${inactiveTenants.length} inativa(s)`}
            {' '}· visível apenas para super-admins
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button className="btn ghost sm" onClick={() => openAudit()}>Logs globais</button>
          <button className="btn primary" onClick={() => { setShowCreate(true); setErr('') }}>
            <IconUserPlus size={13} /> Nova empresa
          </button>
        </div>
      </div>

      {/* Search bar */}
      <div style={{ marginBottom: 12, display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        <input
          className="input input-glass"
          style={{ height: 34, flex: '1 1 220px', minWidth: 180, maxWidth: 320 }}
          placeholder="Filtrar empresa ou slug…"
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
        <div style={{ position: 'relative', flex: '1 1 260px', minWidth: 220, maxWidth: 440 }}>
          <input
            className="input input-glass"
            style={{ height: 34, width: '100%' }}
            placeholder="Pesquisar funcionário…"
            title="Pesquisar funcionário em todas as empresas"
            value={globalSearch}
            onChange={e => handleGlobalSearch(e.target.value)}
          />
          {(globalSearching || globalResults.length > 0) && (
            <div style={{
              position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 50,
              background: 'var(--glass-bg)', backdropFilter: 'blur(var(--glass-blur-lg)) saturate(var(--glass-saturate-lg))', WebkitBackdropFilter: 'blur(var(--glass-blur-lg)) saturate(var(--glass-saturate-lg))',
              border: '1px solid var(--glass-border)', borderRadius: 'var(--r-md)', marginTop: 4,
              boxShadow: '0 8px 24px rgba(0,0,0,0.12)', maxHeight: 300, overflowY: 'auto',
            }}>
              {globalSearching && <div style={{ padding: '12px 14px', fontSize: 12, color: 'var(--fg-muted)' }}>A pesquisar…</div>}
              {!globalSearching && globalResults.length === 0 && globalSearch.length >= 2 && (
                <div style={{ padding: '12px 14px', fontSize: 12, color: 'var(--fg-muted)' }}>Sem resultados.</div>
              )}
              {globalResults.map(r => (
                <div key={r.id} style={{ padding: '10px 14px', borderBottom: '1px solid var(--divider)', fontSize: 13 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ fontWeight: 600 }}>{r.name}</span>
                    <span className="mono" style={{ fontSize: 11, color: 'var(--fg-muted)' }}>{r.username}</span>
                    <span className="chip" style={{ fontSize: 10 }}>{r.role}</span>
                    {!r.active && <span style={{ fontSize: 10, color: 'var(--fg-muted)' }}>inactivo</span>}
                  </div>
                  {r.tenant && (
                    <div style={{ fontSize: 11, color: 'var(--fg-muted)', marginTop: 2 }}>
                      {r.tenant.name} <span className="mono">({r.tenant.slug})</span>
                    </div>
                  )}
                </div>
              ))}
              {globalResults.length > 0 && (
                <div style={{ padding: '6px 14px' }}>
                  <button className="btn ghost sm" onClick={() => { setGlobalSearch(''); setGlobalResults([]) }} style={{ fontSize: 11 }}>Fechar</button>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* KPIs */}
      <div className="kpi-grid" style={{ marginBottom: 16 }}>
        <div className="kpi">
          <div className="kpi-label"><IconBuilding size={12} /> Empresas ativas</div>
          <div className="kpi-value tnum">{activeTenants.length}</div>
        </div>
        <div className="kpi">
          <div className="kpi-label"><IconUsers size={12} /> Funcionários (total)</div>
          <div className="kpi-value tnum">{tenants.reduce((s, t) => s + t.employee_count, 0)}</div>
        </div>
        <div className="kpi">
          <div className="kpi-label"><IconPulse size={12} /> Registos de ponto (total)</div>
          <div className="kpi-value tnum">{tenants.reduce((s, t) => s + t.record_count, 0)}</div>
        </div>
      </div>

      {ok && <div className="alert-inline ok" style={{ marginBottom: 12 }}>{ok}</div>}
      {err && !editing && !resetTarget && !deleteTarget && !deactivateTarget && !adminsTarget && !trialTarget && (
        <div className="alert-inline err" style={{ marginBottom: 12 }}>{err}<button onClick={() => setErr('')} style={{ marginLeft: 8, textDecoration: 'underline', background: 'none', border: 'none', cursor: 'pointer', color: 'inherit', fontSize: 'inherit' }}>×</button></div>
      )}

      {/* Created result */}
      {created && (
        <div className="card" style={{ marginBottom: 16, border: '1px solid var(--success-fg)', background: 'color-mix(in srgb, var(--success-fg) 6%, transparent)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
            <span style={{ fontSize: 16 }}>✓</span>
            <div style={{ fontSize: 13, fontWeight: 700 }}>Empresa &quot;{created.tenant.name}&quot; criada</div>
          </div>
          <div style={{ fontSize: 12, color: 'var(--fg-muted)', marginBottom: 10 }}>Envia esta página ao admin para começar:</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 12px', background: 'var(--surface-2)', border: '1px solid var(--border)', borderRadius: 6, fontFamily: 'var(--font-mono)', fontSize: 12, wordBreak: 'break-all' }}>
            <a href={created.url} target="_blank" rel="noopener noreferrer" style={{ color: 'var(--fg)', textDecoration: 'none', flex: 1 }}>{created.url}</a>
            <button type="button" className="btn ghost sm" onClick={() => copyUrl(created.url)}>{copied ? '✓ Copiado' : 'Copiar'}</button>
          </div>
          <div style={{ marginTop: 8, fontSize: 12, color: 'var(--fg-muted)' }}>
            Login do admin: <code style={{ fontWeight: 700 }}>{created.adminUsername}</code> — senha que definiste. <strong>Não fica registada</strong>.
          </div>
          <div style={{ marginTop: 10 }}><button type="button" className="btn ghost sm" onClick={() => setCreated(null)}>Fechar</button></div>
        </div>
      )}

      {spinOffResult && (
        <div className="card" style={{ marginBottom: 16, border: '1px solid var(--success-fg)', background: 'color-mix(in srgb, var(--success-fg) 6%, transparent)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
            <span style={{ fontSize: 16 }}>✓</span>
            <div style={{ fontSize: 13, fontWeight: 700 }}>Plataforma separada</div>
          </div>
          <div style={{ fontSize: 12, color: 'var(--fg-muted)', lineHeight: 1.6 }}>
            Dados movidos para <strong>&quot;{spinOffResult.tenant.name}&quot;</strong>. Nova conta de controlador: <code style={{ fontWeight: 700 }}>{spinOffResult.controllerUsername}</code>.
          </div>
          <div style={{ marginTop: 10 }}><button type="button" className="btn ghost sm" onClick={() => setSpinOffResult(null)}>Fechar</button></div>
        </div>
      )}

      {/* Active tenants table */}
      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
        {loading ? (
          <div style={{ padding: 24, textAlign: 'center', color: 'var(--fg-muted)', fontSize: 13 }}>A carregar…</div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table className="table" style={{ width: '100%', minWidth: 860 }}>
              <thead>
                <tr>
                  <th>Empresa</th>
                  <th>Plano</th>
                  <th style={{ textAlign: 'right' }}>Func.</th>
                  <th style={{ textAlign: 'right' }}>Registos</th>
                  <th>Última batida</th>
                  <th>Último login</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {activeTenants.map(t => (
                  <tr key={t.id}>
                    <td style={{ fontWeight: 600 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        {t.name}
                        {t.id === DEFAULT_TENANT_ID && (
                          <span className="chip accent" style={{ fontSize: 10 }}>Plataforma</span>
                        )}
                      </div>
                      <a href={tenantUrl(t)} target="_blank" rel="noopener noreferrer"
                         className="mono" style={{ fontSize: 11, color: 'var(--fg-muted)', textDecoration: 'none' }}>
                        {tenantUrl(t)}
                      </a>
                      {t.health && <HealthBadges health={t.health} trialDaysLeft={t.trial_days_left ?? null} />}
                    </td>
                    <td>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                        <span className="chip" style={{ fontSize: 11 }}>{t.plan}</span>
                        {t.trial_days_left !== null && t.trial_days_left > 0 && (
                          <span style={{ fontSize: 10, color: '#d97706' }}>Trial: {t.trial_days_left}d</span>
                        )}
                      </div>
                    </td>
                    <td className="tnum" style={{ textAlign: 'right' }} title={`${t.employee_count} activos / ${t.employee_total} total`}>
                      {t.employee_count} <span style={{ color: 'var(--fg-subtle)', fontSize: 11 }}>/ {limitLabel(t.plan)}</span>
                    </td>
                    <td className="tnum" style={{ textAlign: 'right', fontSize: 12 }}>{t.record_count.toLocaleString('pt-BR')}</td>
                    <td style={{ fontSize: 12, color: 'var(--fg-muted)' }}>{timeAgo(t.last_punch_at)}</td>
                    <td style={{ fontSize: 12, color: 'var(--fg-muted)' }}>{timeAgo(t.last_login_at)}</td>
                    <td style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>
                      <button className="btn ghost sm" onClick={() => openEdit(t)}>Editar</button>
                      {t.id !== DEFAULT_TENANT_ID && (
                        <>
                          <button className="btn ghost sm" disabled={impersonating === t.id} onClick={() => handleImpersonate(t)} style={{ marginLeft: 6 }} title="Entrar como admin desta empresa">
                            {impersonating === t.id ? '…' : 'Entrar como'}
                          </button>
                          <button className="btn ghost sm" onClick={() => openAdmins(t)} style={{ marginLeft: 6 }}>Admins</button>
                          <button className="btn ghost sm" onClick={() => openReset(t)} style={{ marginLeft: 6 }}>Reset senha</button>
                          <button className="btn ghost sm" onClick={() => openAudit(t.id)} style={{ marginLeft: 6 }}>Logs</button>
                          <button className="btn ghost sm" disabled={exporting === t.id} onClick={() => handleExport(t)} style={{ marginLeft: 6 }}>
                            {exporting === t.id ? '…' : 'Export'}
                          </button>
                          <button className="btn ghost sm" onClick={() => { setTrialTarget(t); setTrialDays(String(t.trial_days_left ?? 14)); setErr('') }} style={{ marginLeft: 6 }}>Trial</button>
                          <button className="btn ghost sm" onClick={() => { setDeactivateTarget(t); setErr('') }} style={{ marginLeft: 6 }}>Desativar</button>
                        </>
                      )}
                      {t.id === DEFAULT_TENANT_ID && (
                        <button className="btn ghost sm" onClick={() => { setShowSpinOff(true); setErr('') }} style={{ marginLeft: 6 }}>
                          Separar plataforma
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
                {activeTenants.length === 0 && (
                  <tr><td colSpan={7} style={{ textAlign: 'center', color: 'var(--fg-muted)', padding: 24 }}>Nenhuma empresa ativa.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Inactive tenants */}
      {!loading && inactiveTenants.length > 0 && (
        <div style={{ marginTop: 16 }}>
          <button className="btn ghost sm" onClick={() => setShowInactive(v => !v)} style={{ fontSize: 12, color: 'var(--fg-muted)' }}>
            {showInactive ? '▲' : '▼'} Inativas ({inactiveTenants.length})
          </button>
          {showInactive && (
            <div className="card" style={{ padding: 0, overflow: 'hidden', marginTop: 8 }}>
              <div style={{ overflowX: 'auto' }}>
                <table className="table" style={{ width: '100%', opacity: 0.8 }}>
                  <thead>
                    <tr><th>Empresa</th><th>Slug</th><th style={{ textAlign: 'right' }}>Registos</th><th></th></tr>
                  </thead>
                  <tbody>
                    {inactiveTenants.map(t => (
                      <tr key={t.id}>
                        <td style={{ fontWeight: 600 }}>
                          <div>{t.name}</div>
                          <span className="mono" style={{ fontSize: 11, color: 'var(--fg-muted)' }}>{t.slug}</span>
                        </td>
                        <td className="mono" style={{ fontSize: 12 }}>{t.slug}</td>
                        <td className="tnum" style={{ textAlign: 'right', fontSize: 12 }}>{t.record_count}</td>
                        <td style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>
                          <button className="btn ghost sm" onClick={() => openEdit(t)}>Editar</button>
                          <button className="btn ghost sm" onClick={() => { setDeactivateTarget(t); setErr('') }} style={{ marginLeft: 6 }}>Reativar</button>
                          {t.record_count === 0 && (
                            <button className="btn ghost sm" disabled={saving} onClick={() => { setDeleteTarget(t); setDeleteConfirm('') }} style={{ marginLeft: 6, color: 'var(--danger-fg)' }}>
                              Eliminar
                            </button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div style={{ padding: '8px 16px', fontSize: 11, color: 'var(--fg-muted)', borderTop: '1px solid var(--divider)' }}>
                &ldquo;Eliminar&rdquo; disponível apenas para empresas sem registos de ponto.
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── Modal: Nova empresa ── */}
      {showCreate && (
        <Modal title="Nova empresa" onClose={() => { setShowCreate(false); setErr('') }} width={640}>
          <form onSubmit={handleCreate} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            {err && <div className="alert-inline err">{err}</div>}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 10 }}>
              <div className="field">
                <label>Nome</label>
                <input className="input" style={inputStyle} value={name} onChange={e => setName(e.target.value)} placeholder="Empresa A" required autoFocus />
              </div>
              <div className="field">
                <label>Slug (subdomínio)</label>
                <input className="input" style={inputStyle} value={slug} onChange={e => setSlug(e.target.value)} onBlur={e => setSlug(slugifyTenantInput(e.target.value))} placeholder="empresa-a" pattern="[a-z0-9]+(-[a-z0-9]+)*" minLength={2} maxLength={40} required />
              </div>
              <div className="field">
                <label>Domínio custom (opcional)</label>
                <input className="input" style={inputStyle} value={domain} onChange={e => setDomain(e.target.value)} onBlur={e => setDomain(normalizeCustomDomain(e.target.value) ?? '')} placeholder="ponto.empresa.com" />
              </div>
            </div>
            <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--fg-muted)', display: 'flex', alignItems: 'center', gap: 6 }}>
              Configurações padrão
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 10 }}>
              <div className="field">
                <label>Jornada (h/dia)</label>
                <input className="input" style={inputStyle} type="number" min={1} max={24} step={0.5} value={workdayHours} onChange={e => setWorkdayHours(e.target.value)} />
              </div>
              <div className="field">
                <label>Pausa almoço (min)</label>
                <input className="input" style={inputStyle} type="number" min={0} max={120} value={lunchMinutes} onChange={e => setLunchMinutes(e.target.value)} />
              </div>
            </div>
            <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--fg-muted)', display: 'flex', alignItems: 'center', gap: 6 }}>
              <IconBuilding size={12} /> Admin inicial da empresa
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 10 }}>
              <div className="field">
                <label>Nome do admin</label>
                <input className="input" style={inputStyle} value={adminName} onChange={e => setAdminName(e.target.value)} placeholder="Maria Silva" required />
              </div>
              <div className="field">
                <label>Usuário</label>
                <input className="input" style={inputStyle} value={adminUsername} onChange={e => setAdminUsername(e.target.value)} placeholder="maria.silva" autoCapitalize="none" required />
              </div>
              <div className="field">
                <label>Senha (mín. 6)</label>
                <input className="input" style={inputStyle} type="password" value={adminPassword} onChange={e => setAdminPassword(e.target.value)} minLength={6} required />
              </div>
            </div>
            <div style={{ display: 'flex', gap: 8, paddingTop: 4 }}>
              <button type="submit" className="btn primary" disabled={saving}>{saving ? 'A criar…' : 'Criar empresa'}</button>
              <button type="button" className="btn ghost" onClick={() => setShowCreate(false)}>Cancelar</button>
            </div>
          </form>
        </Modal>
      )}

      {/* ── Modal: Editar empresa ── */}
      {editing && (
        <Modal title={`Editar "${editing.name}"`} onClose={() => setEditing(null)} width={480}>
          <form onSubmit={handleEdit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            {err && <div className="alert-inline err">{err}</div>}
            <div style={{ fontSize: 11, color: 'var(--fg-muted)' }}>Slug: <code>{editing.slug}</code> — imutável</div>
            <div className="field">
              <label>Nome</label>
              <input className="input" style={inputStyle} value={editName} onChange={e => setEditName(e.target.value)} required autoFocus />
            </div>
            <div className="field">
              <label>Domínio custom (vazio = remover)</label>
              <input className="input" style={inputStyle} value={editDomain} onChange={e => setEditDomain(e.target.value)} onBlur={e => setEditDomain(normalizeCustomDomain(e.target.value) ?? '')} placeholder="ponto.empresa.com" />
            </div>
            <div className="field">
              <label>Plano</label>
              <select className="input" style={inputStyle} value={editPlan} onChange={e => setEditPlan(e.target.value)}>
                {PLANS.map(p => <option key={p} value={p}>{p}</option>)}
              </select>
            </div>
            <div style={{ display: 'flex', gap: 8, paddingTop: 4 }}>
              <button type="submit" className="btn primary" disabled={saving}>{saving ? 'A guardar…' : 'Guardar'}</button>
              <button type="button" className="btn ghost" onClick={() => setEditing(null)}>Cancelar</button>
            </div>
          </form>
        </Modal>
      )}

      {/* ── Modal: Confirmar desativar/reativar ── */}
      {deactivateTarget && (
        <Modal title={deactivateTarget.active ? '⚠ Desativar empresa' : 'Reativar empresa'} onClose={() => setDeactivateTarget(null)} width={420}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {err && <div className="alert-inline err">{err}</div>}
            <p style={{ fontSize: 13, color: 'var(--fg-muted)', lineHeight: 1.6, margin: 0 }}>
              {deactivateTarget.active
                ? <>Desativar <strong>{deactivateTarget.name}</strong> bloqueará imediatamente o login de todos os seus funcionários ({deactivateTarget.employee_count} activos). Os dados ficam preservados e podes reativar quando quiseres.</>
                : <>Reativar <strong>{deactivateTarget.name}</strong> permite que os seus funcionários voltem a fazer login.</>
              }
            </p>
            <div style={{ display: 'flex', gap: 8 }}>
              <button
                className="btn sm"
                disabled={saving}
                onClick={confirmToggleActive}
                style={deactivateTarget.active ? { background: 'var(--danger-fg)', color: '#fff' } : {}}
              >
                {saving ? '…' : deactivateTarget.active ? 'Desativar' : 'Reativar'}
              </button>
              <button className="btn ghost sm" onClick={() => setDeactivateTarget(null)}>Cancelar</button>
            </div>
          </div>
        </Modal>
      )}

      {/* ── Modal: Reset senha ── */}
      {resetTarget && (
        <Modal title={`Reset senha — ${resetTarget.name}`} onClose={() => { setResetTarget(null); setErr('') }} width={440}>
          <form onSubmit={handleReset} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            {err && <div className="alert-inline err">{err}</div>}
            <div className="field">
              <label>Admin / Manager</label>
              <select className="input" style={inputStyle} value={resetEmployeeId} onChange={e => setResetEmployeeId(e.target.value)} required>
                {resetAdmins.map(a => (
                  <option key={a.id} value={a.id}>{a.name} ({a.username}){!a.active ? ' — inativo' : ''}</option>
                ))}
              </select>
            </div>
            <div className="field">
              <label>Nova senha (mín. 6)</label>
              <input className="input" style={inputStyle} type="password" value={resetPassword} onChange={e => setResetPassword(e.target.value)} minLength={6} required autoFocus />
            </div>
            <div style={{ display: 'flex', gap: 8, paddingTop: 4 }}>
              <button type="submit" className="btn primary" disabled={resetting}>{resetting ? 'A redefinir…' : 'Redefinir senha'}</button>
              <button type="button" className="btn ghost" onClick={() => setResetTarget(null)}>Cancelar</button>
            </div>
          </form>
        </Modal>
      )}

      {/* ── Modal: Eliminar empresa ── */}
      {deleteTarget && (
        <Modal title="⚠ Eliminar permanentemente" onClose={() => { setDeleteTarget(null); setDeleteConfirm(''); setErr('') }} width={420}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div style={{ fontSize: 13, color: 'var(--fg-muted)', lineHeight: 1.6 }}>
              Esta acção é <strong>irreversível</strong>. Elimina a empresa <strong>{deleteTarget.name}</strong> e todos os seus dados.<br /><br />
              Escreve o nome exacto para confirmar:
            </div>
            <input className="input" style={{ height: 34 }} value={deleteConfirm} onChange={e => setDeleteConfirm(e.target.value)} placeholder={deleteTarget.name} autoFocus />
            {err && <div className="alert-inline err">{err}</div>}
            <div style={{ display: 'flex', gap: 8 }}>
              <button className="btn sm" disabled={deleteConfirm !== deleteTarget.name || deleting} onClick={handleDelete}
                style={{ background: deleteConfirm === deleteTarget.name ? 'var(--danger-fg)' : undefined, color: deleteConfirm === deleteTarget.name ? '#fff' : undefined, opacity: deleteConfirm !== deleteTarget.name ? 0.45 : 1 }}>
                {deleting ? 'A eliminar…' : 'Eliminar permanentemente'}
              </button>
              <button className="btn ghost sm" onClick={() => { setDeleteTarget(null); setDeleteConfirm(''); setErr('') }}>Cancelar</button>
            </div>
          </div>
        </Modal>
      )}

      {/* ── Modal: Logs globais ── */}
      {showAudit && (
        <Modal title={auditTenant ? `Logs — ${tenants.find(t => t.id === auditTenant)?.name ?? auditTenant}` : 'Logs globais'} onClose={() => setShowAudit(false)} width={760}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <select className="input" style={{ height: 32, fontSize: 12, flex: 1 }} value={auditTenant}
                onChange={e => { setAuditTenant(e.target.value); loadAudit(e.target.value || undefined) }}>
                <option value="">Todas as empresas</option>
                {tenants.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
              </select>
              <button className="btn ghost sm" onClick={() => loadAudit(auditTenant || undefined)}>↻ Atualizar</button>
            </div>
            {auditLoading ? (
              <div style={{ textAlign: 'center', padding: 24, color: 'var(--fg-muted)', fontSize: 13 }}>A carregar…</div>
            ) : (
              <div style={{ maxHeight: 420, overflowY: 'auto' }}>
                <table className="table" style={{ width: '100%', fontSize: 12 }}>
                  <thead>
                    <tr>
                      <th>Quando</th>
                      {!auditTenant && <th>Empresa</th>}
                      <th>Actor</th>
                      <th>Acção</th>
                      <th>Alvo</th>
                    </tr>
                  </thead>
                  <tbody>
                    {auditLogs.map((log: Record<string, unknown>) => (
                      <tr key={String(log.id)}>
                        <td style={{ whiteSpace: 'nowrap', color: 'var(--fg-muted)' }}>
                          {new Date(String(log.created_at)).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })}
                        </td>
                        {!auditTenant && (
                          <td style={{ fontSize: 11 }}>
                            {(log.tenant as Record<string, unknown>)?.name as string ?? '—'}
                          </td>
                        )}
                        <td style={{ fontWeight: 600 }}>{String(log.actor_name ?? '—')}</td>
                        <td className="mono" style={{ fontSize: 11 }}>{String(log.action)}</td>
                        <td style={{ color: 'var(--fg-muted)' }}>{String(log.target_name ?? '—')}</td>
                      </tr>
                    ))}
                    {auditLogs.length === 0 && (
                      <tr><td colSpan={5} style={{ textAlign: 'center', color: 'var(--fg-muted)', padding: 20 }}>Sem logs.</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </Modal>
      )}

      {/* ── Modal: Gerir admins ── */}
      {adminsTarget && (
        <Modal title={`Admins — ${adminsTarget.name}`} onClose={() => { setAdminsTarget(null); setErr('') }} width={580}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {err && <div className="alert-inline err">{err}</div>}
            <div style={{ maxHeight: 240, overflowY: 'auto' }}>
              <table className="table" style={{ width: '100%', fontSize: 12 }}>
                <thead><tr><th>Nome</th><th>Usuário</th><th>Cargo</th><th>Estado</th><th></th></tr></thead>
                <tbody>
                  {adminsList.map(a => (
                    <tr key={a.id}>
                      <td style={{ fontWeight: 600 }}>{a.name}</td>
                      <td className="mono" style={{ fontSize: 11 }}>{a.username}</td>
                      <td><span className="chip" style={{ fontSize: 10 }}>{a.role}</span></td>
                      <td><span style={{ fontSize: 11, color: a.active ? 'var(--success-fg)' : 'var(--fg-muted)' }}>{a.active ? 'Activo' : 'Inactivo'}</span></td>
                      <td style={{ textAlign: 'right' }}>
                        <button className="btn ghost sm" disabled={togglingAdmin === a.id} onClick={() => handleToggleAdmin(a.id, !a.active)}>
                          {togglingAdmin === a.id ? '…' : a.active ? 'Desativar' : 'Ativar'}
                        </button>
                      </td>
                    </tr>
                  ))}
                  {adminsList.length === 0 && <tr><td colSpan={5} style={{ textAlign: 'center', color: 'var(--fg-muted)', padding: 16 }}>Nenhum admin encontrado.</td></tr>}
                </tbody>
              </table>
            </div>
            <div style={{ borderTop: '1px solid var(--divider)', paddingTop: 14 }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--fg-muted)', marginBottom: 10 }}>Criar novo admin</div>
              <form onSubmit={handleCreateAdmin} style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 10 }}>
                  <div className="field"><label>Nome</label><input className="input" style={inputStyle} value={newAdminName} onChange={e => setNewAdminName(e.target.value)} required /></div>
                  <div className="field"><label>Usuário</label><input className="input" style={inputStyle} value={newAdminUsername} onChange={e => setNewAdminUsername(e.target.value)} autoCapitalize="none" required /></div>
                  <div className="field"><label>Senha (mín. 6)</label><input className="input" style={inputStyle} type="password" value={newAdminPassword} onChange={e => setNewAdminPassword(e.target.value)} minLength={6} required /></div>
                  <div className="field">
                    <label>Cargo</label>
                    <select className="input" style={inputStyle} value={newAdminRole} onChange={e => setNewAdminRole(e.target.value)}>
                      <option value="admin">Admin</option>
                      <option value="manager">Manager</option>
                    </select>
                  </div>
                </div>
                <button type="submit" className="btn primary sm" disabled={creatingAdmin} style={{ alignSelf: 'flex-start' }}>
                  {creatingAdmin ? 'A criar…' : 'Criar admin'}
                </button>
              </form>
            </div>
          </div>
        </Modal>
      )}

      {/* ── Modal: Trial ── */}
      {trialTarget && (
        <Modal title={`Trial — ${trialTarget.name}`} onClose={() => { setTrialTarget(null); setErr('') }} width={380}>
          <form onSubmit={handleSetTrial} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            {err && <div className="alert-inline err">{err}</div>}
            <div style={{ fontSize: 13, color: 'var(--fg-muted)', lineHeight: 1.6 }}>
              {trialTarget.trial_days_left !== null && trialTarget.trial_days_left > 0
                ? <>Trial activo: <strong>{trialTarget.trial_days_left} dias restantes</strong>.</>
                : trialTarget.trial_ends_at
                  ? <span style={{ color: 'var(--danger-fg)' }}>Trial <strong>expirado</strong>.</span>
                  : 'Sem trial activo.'
              }
            </div>
            <div className="field">
              <label>Dias de trial (0 = remover trial)</label>
              <input className="input" style={inputStyle} type="number" min={0} max={365} value={trialDays} onChange={e => setTrialDays(e.target.value)} />
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <button type="submit" className="btn primary sm" disabled={savingTrial}>{savingTrial ? '…' : 'Aplicar'}</button>
              <button type="button" className="btn ghost sm" onClick={() => setTrialTarget(null)}>Cancelar</button>
            </div>
          </form>
        </Modal>
      )}

      {/* ── Modal: Separar plataforma ── */}
      {showSpinOff && defaultTenant && (
        <Modal title="⚠ Separar plataforma" onClose={() => { setShowSpinOff(false); setSpConfirm(''); setErr('') }} width={620}>
          <form onSubmit={handleSpinOff} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            {err && <div className="alert-inline err">{err}</div>}
            <div style={{ fontSize: 13, color: 'var(--fg-muted)', lineHeight: 1.6 }}>
              Move <strong>todos os dados</strong> de &quot;{defaultTenant.name}&quot; ({defaultTenant.employee_count} funcionário(s)) para uma empresa própria e cria uma conta de controlador separada. <strong>Irreversível por esta ferramenta.</strong>
            </div>
            {!ROOT_DOMAIN && (
              <div className="alert-inline warn">⚠ Sem <code>NEXT_PUBLIC_TENANT_ROOT_DOMAIN</code>: a nova empresa só fica acessível com um <strong>domínio custom</strong>.</div>
            )}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 10 }}>
              <div className="field"><label>Nome</label><input className="input" style={inputStyle} value={spName} onChange={e => setSpName(e.target.value)} placeholder={defaultTenant.name} required autoFocus /></div>
              <div className="field"><label>Slug</label><input className="input" style={inputStyle} value={spSlug} onChange={e => setSpSlug(e.target.value)} onBlur={e => setSpSlug(slugifyTenantInput(e.target.value))} placeholder="dac-industrial" pattern="[a-z0-9]+(-[a-z0-9]+)*" minLength={2} maxLength={40} required /></div>
              <div className="field"><label>Domínio custom{ROOT_DOMAIN ? ' (opcional)' : ' — obrigatório'}</label><input className="input" style={inputStyle} value={spDomain} onChange={e => setSpDomain(e.target.value)} onBlur={e => setSpDomain(normalizeCustomDomain(e.target.value) ?? '')} placeholder="ponto.empresa.com" required={!ROOT_DOMAIN} /></div>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 10 }}>
              <div className="field"><label>Nome do controlador</label><input className="input" style={inputStyle} value={spControllerName} onChange={e => setSpControllerName(e.target.value)} required /></div>
              <div className="field"><label>Usuário</label><input className="input" style={inputStyle} value={spControllerUsername} onChange={e => setSpControllerUsername(e.target.value)} autoCapitalize="none" required /></div>
              <div className="field"><label>Senha (mín. 6)</label><input className="input" style={inputStyle} type="password" value={spControllerPassword} onChange={e => setSpControllerPassword(e.target.value)} minLength={6} required /></div>
            </div>
            <div style={{ fontSize: 13, color: 'var(--fg-muted)' }}>Escreve o nome exacto de &quot;{defaultTenant.name}&quot; para confirmar:</div>
            <input className="input" style={{ height: 34 }} value={spConfirm} onChange={e => setSpConfirm(e.target.value)} placeholder={defaultTenant.name} />
            <div style={{ display: 'flex', gap: 8, paddingTop: 4 }}>
              <button type="submit" className="btn sm" disabled={spConfirm !== defaultTenant.name || spinningOff}
                style={{ background: spConfirm === defaultTenant.name ? 'var(--danger-fg)' : undefined, color: spConfirm === defaultTenant.name ? '#fff' : undefined, opacity: spConfirm !== defaultTenant.name ? 0.45 : 1 }}>
                {spinningOff ? 'A separar…' : 'Separar plataforma'}
              </button>
              <button type="button" className="btn ghost sm" onClick={() => { setShowSpinOff(false); setSpConfirm(''); setErr('') }}>Cancelar</button>
            </div>
          </form>
        </Modal>
      )}
    </>
  )
}
