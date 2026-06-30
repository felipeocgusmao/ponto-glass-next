'use client'

import { useState, useEffect, useCallback } from 'react'
import type { Tenant } from '@/lib/types'
import { IconBuilding, IconUserPlus, IconUsers, IconPulse } from '../icons'
import { Modal } from '../Modal'

type TenantRow = Tenant & { employee_count: number; record_count: number }

const inputStyle = { height: 34 } as const

const ROOT_DOMAIN = process.env.NEXT_PUBLIC_TENANT_ROOT_DOMAIN ?? ''

// Mirrors lib/tenant.ts's DEFAULT_TENANT_ID as a plain literal — that module
// also imports the service-role Supabase client, which must never be bundled
// into client code.
const DEFAULT_TENANT_ID = '00000000-0000-0000-0000-000000000001'

/** Where the admin of this tenant should send their employees to log in. */
function tenantUrl(t: { slug: string; domain: string | null }): string {
  if (t.domain) return `https://${t.domain}`
  if (ROOT_DOMAIN) return `https://${t.slug}.${ROOT_DOMAIN}`
  if (typeof window !== 'undefined') return window.location.origin
  return ''
}

type CreatedTenant = {
  tenant: TenantRow
  adminUsername: string
  url: string
}

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
  const [deleteTarget, setDeleteTarget] = useState<TenantRow | null>(null)
  const [deleteConfirm, setDeleteConfirm] = useState('')
  const [deleting, setDeleting] = useState(false)

  // Create form
  const [name, setName] = useState('')
  const [slug, setSlug] = useState('')
  const [domain, setDomain] = useState('')
  const [adminName, setAdminName] = useState('')
  const [adminUsername, setAdminUsername] = useState('')
  const [adminPassword, setAdminPassword] = useState('')

  // Edit form
  const [editName, setEditName] = useState('')
  const [editDomain, setEditDomain] = useState('')

  // Spin-off (platform/controller separation) form + result
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
        }),
      })
      const data = await res.json()
      if (!res.ok) { setErr(data.error ?? 'Erro ao criar empresa'); return }
      const createdUsername = adminUsername.trim().toLowerCase()
      setName(''); setSlug(''); setDomain(''); setAdminName(''); setAdminUsername(''); setAdminPassword('')
      setShowCreate(false)
      setCreated({ tenant: data, adminUsername: createdUsername, url: tenantUrl(data) })
      await load()
    } catch { setErr('Erro de conexão') }
    finally { setSaving(false) }
  }

  const copyUrl = async (url: string) => {
    try {
      await navigator.clipboard.writeText(url)
      setCopied(true)
      setTimeout(() => setCopied(false), 1800)
    } catch { /* clipboard may be blocked */ }
  }

  const handleEdit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!editing) return
    setSaving(true); setErr('')
    try {
      const res = await fetch(`/api/tenants/${editing.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: editName, domain: editDomain.trim() || null }),
      })
      const data = await res.json()
      if (!res.ok) { setErr(data.error ?? 'Erro ao atualizar'); return }
      setEditing(null)
      flash('Empresa atualizada.')
      await load()
    } catch { setErr('Erro de conexão') }
    finally { setSaving(false) }
  }

  const toggleActive = async (t: TenantRow) => {
    if (saving) return
    setSaving(true); setErr('')
    try {
      const res = await fetch(`/api/tenants/${t.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ active: !t.active }),
      })
      const data = await res.json()
      if (!res.ok) { setErr(data.error ?? 'Erro ao atualizar'); return }
      flash(data.active ? `Empresa "${data.name}" reativada.` : `Empresa "${data.name}" desativada.`)
      await load()
    } catch { setErr('Erro de conexão') }
    finally { setSaving(false) }
  }

  const openEdit = (t: TenantRow) => {
    setEditing(t); setEditName(t.name); setEditDomain(t.domain ?? ''); setErr('')
  }

  const defaultTenant = tenants.find(t => t.id === DEFAULT_TENANT_ID)

  const handleSpinOff = async (e: React.FormEvent) => {
    e.preventDefault()
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
      if (res.status === 207) setErr(data.error) // partial success — surface alongside the result panel
      await load()
    } catch { setErr('Erro de conexão') }
    finally { setSpinningOff(false) }
  }

  return (
    <>
      <div className="page-head">
        <div>
          <div className="page-title">Empresas</div>
          <div className="page-sub">
            {tenants.filter(t => t.active).length} ativa(s)
            {tenants.filter(t => !t.active).length > 0 && ` · ${tenants.filter(t => !t.active).length} inativa(s)`}
            {' '}· visível apenas para super-admins
          </div>
        </div>
        <button className="btn primary" onClick={() => { setShowCreate(true); setErr('') }}>
          <IconUserPlus size={13} /> Nova empresa
        </button>
      </div>

      {/* Cross-tenant overview — the home screen for a platform controller (no
          operational dashboard of their own to land on). */}
      <div className="kpi-grid" style={{ marginBottom: 16 }}>
        <div className="kpi">
          <div className="kpi-label"><IconBuilding size={12} /> Empresas ativas</div>
          <div className="kpi-value tnum">{tenants.filter(t => t.active).length}</div>
        </div>
        <div className="kpi">
          <div className="kpi-label"><IconUsers size={12} /> Funcionários (total)</div>
          <div className="kpi-value tnum">{tenants.reduce((sum, t) => sum + t.employee_count, 0)}</div>
        </div>
        <div className="kpi">
          <div className="kpi-label"><IconPulse size={12} /> Registos de ponto (total)</div>
          <div className="kpi-value tnum">{tenants.reduce((sum, t) => sum + t.record_count, 0)}</div>
        </div>
      </div>

      {ok && <div className="alert-inline ok" style={{ marginBottom: 12 }}>{ok}</div>}

      {created && (
        <div className="card" style={{
          marginBottom: 16,
          border: '1px solid var(--ok-fg, #2ea043)',
          background: 'color-mix(in srgb, var(--ok-fg, #2ea043) 6%, transparent)',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
            <span style={{ fontSize: 16 }}>✓</span>
            <div style={{ fontSize: 13, fontWeight: 700 }}>Empresa &quot;{created.tenant.name}&quot; criada</div>
          </div>
          <div style={{ fontSize: 12, color: 'var(--fg-muted)', marginBottom: 10 }}>
            Envia esta página ao admin para começar:
          </div>
          <div style={{
            display: 'flex', alignItems: 'center', gap: 8, padding: '8px 12px',
            background: 'var(--bg-subtle, rgba(0,0,0,0.04))',
            border: '1px solid var(--border)', borderRadius: 6,
            fontFamily: 'var(--mono, ui-monospace, monospace)', fontSize: 12,
            wordBreak: 'break-all',
          }}>
            <a href={created.url} target="_blank" rel="noopener noreferrer"
               style={{ color: 'var(--fg)', textDecoration: 'none', flex: 1 }}>
              {created.url}
            </a>
            <button type="button" className="btn ghost sm" onClick={() => copyUrl(created.url)}>
              {copied ? '✓ Copiado' : 'Copiar'}
            </button>
          </div>
          <div style={{ marginTop: 8, fontSize: 12, color: 'var(--fg-muted)' }}>
            Login do admin: <code style={{ fontWeight: 700 }}>{created.adminUsername}</code>
            {' '}— senha que definiste. <strong>Não fica registada</strong>, partilha-a por canal seguro.
            {!created.tenant.domain && !ROOT_DOMAIN && (
              <div style={{ marginTop: 6, padding: 8, background: 'var(--warning-bg, rgba(255,180,0,0.1))', borderRadius: 4, fontSize: 11 }}>
                ⚠ <code>NEXT_PUBLIC_TENANT_ROOT_DOMAIN</code> não está configurado — a URL acima é apenas o domínio atual.
                Define-o no Vercel + DNS wildcard para activar subdomínios por empresa (ver <code>docs/TENANTS.md</code>).
              </div>
            )}
          </div>
          <div style={{ marginTop: 10 }}>
            <button type="button" className="btn ghost sm" onClick={() => setCreated(null)}>Fechar</button>
          </div>
        </div>
      )}

      {spinOffResult && (
        <div className="card" style={{
          marginBottom: 16,
          border: '1px solid var(--ok-fg, #2ea043)',
          background: 'color-mix(in srgb, var(--ok-fg, #2ea043) 6%, transparent)',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
            <span style={{ fontSize: 16 }}>✓</span>
            <div style={{ fontSize: 13, fontWeight: 700 }}>Plataforma separada</div>
          </div>
          <div style={{ fontSize: 12, color: 'var(--fg-muted)', lineHeight: 1.6 }}>
            Todos os dados operacionais foram movidos para <strong>&quot;{spinOffResult.tenant.name}&quot;</strong> — os funcionários
            de lá continuam a entrar com as <strong>mesmas credenciais de sempre</strong> (só mudaram de empresa).
            <br /><br />
            A nova conta de controlador da plataforma é <code style={{ fontWeight: 700 }}>{spinOffResult.controllerUsername}</code>
            {' '}— a senha que definiste. <strong>Não fica registada</strong>, guarda-a num gestor de senhas.
          </div>
          <div style={{ marginTop: 10 }}>
            <button type="button" className="btn ghost sm" onClick={() => setSpinOffResult(null)}>Fechar</button>
          </div>
        </div>
      )}

      {/* Active tenants */}
      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
        {loading ? (
          <div style={{ padding: 24, textAlign: 'center', color: 'var(--fg-muted)', fontSize: 13 }}>A carregar…</div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table className="table" style={{ width: '100%', minWidth: 760 }}>
              <thead>
                <tr>
                  <th>Empresa</th>
                  <th>Slug</th>
                  <th>Domínio custom</th>
                  <th>Plano</th>
                  <th style={{ textAlign: 'right' }}>Funcionários</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {tenants.filter(t => t.active).map(t => (
                  <tr key={t.id}>
                    <td style={{ fontWeight: 600 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        {t.name}
                        {t.id === DEFAULT_TENANT_ID && (
                          <span className="chip accent" style={{ fontSize: 10 }} title="Tenant da plataforma — controladores (super-admins) vivem aqui">Plataforma</span>
                        )}
                      </div>
                      <a href={tenantUrl(t)} target="_blank" rel="noopener noreferrer"
                         className="mono" style={{ fontSize: 11, color: 'var(--fg-muted)', textDecoration: 'none', whiteSpace: 'nowrap' }}>
                        {tenantUrl(t)}
                      </a>
                    </td>
                    <td className="mono" style={{ fontSize: 12 }}>{t.slug}</td>
                    <td className="mono" style={{ fontSize: 12 }}>{t.domain ?? '—'}</td>
                    <td>{t.plan}</td>
                    <td className="tnum" style={{ textAlign: 'right' }}>{t.employee_count}</td>
                    <td style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>
                      <button className="btn ghost sm" onClick={() => openEdit(t)}>Editar</button>
                      {t.id === DEFAULT_TENANT_ID ? (
                        <button
                          className="btn ghost sm"
                          onClick={() => { setShowSpinOff(true); setErr('') }}
                          style={{ marginLeft: 6 }}
                          title="Move os dados operacionais para um tenant próprio e cria uma conta de controlador separada"
                        >
                          Separar plataforma
                        </button>
                      ) : (
                        <button className="btn ghost sm" disabled={saving} onClick={() => toggleActive(t)} style={{ marginLeft: 6 }}>
                          Desativar
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
                {tenants.filter(t => t.active).length === 0 && (
                  <tr><td colSpan={6} style={{ textAlign: 'center', color: 'var(--fg-muted)', padding: 24 }}>Nenhuma empresa ativa.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Inactive tenants — collapsible */}
      {!loading && tenants.filter(t => !t.active).length > 0 && (
        <div style={{ marginTop: 16 }}>
          <button
            className="btn ghost sm"
            onClick={() => setShowInactive(v => !v)}
            style={{ fontSize: 12, color: 'var(--fg-muted)' }}
          >
            {showInactive ? '▲' : '▼'} Inativas ({tenants.filter(t => !t.active).length})
          </button>
          {showInactive && (
            <div className="card" style={{ padding: 0, overflow: 'hidden', marginTop: 8 }}>
              <div style={{ overflowX: 'auto' }}>
                <table className="table" style={{ width: '100%', opacity: 0.8 }}>
                  <thead>
                    <tr>
                      <th>Empresa</th>
                      <th>Slug</th>
                      <th style={{ textAlign: 'right' }}>Registos</th>
                      <th></th>
                    </tr>
                  </thead>
                  <tbody>
                    {tenants.filter(t => !t.active).map(t => (
                      <tr key={t.id}>
                        <td style={{ fontWeight: 600 }}>
                          <div>{t.name}</div>
                          <span className="mono" style={{ fontSize: 11, color: 'var(--fg-muted)' }}>{t.slug}</span>
                        </td>
                        <td className="mono" style={{ fontSize: 12 }}>{t.slug}</td>
                        <td className="tnum" style={{ textAlign: 'right', fontSize: 12 }}>{t.record_count}</td>
                        <td style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>
                          <button className="btn ghost sm" onClick={() => openEdit(t)}>Editar</button>
                          <button className="btn ghost sm" disabled={saving} onClick={() => toggleActive(t)} style={{ marginLeft: 6 }}>
                            Reativar
                          </button>
                          {t.record_count === 0 && (
                            <button
                              className="btn ghost sm"
                              disabled={saving}
                              onClick={() => { setDeleteTarget(t); setDeleteConfirm('') }}
                              style={{ marginLeft: 6, color: 'var(--err-fg, #c53030)' }}
                            >
                              Eliminar
                            </button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div style={{ padding: '8px 16px', fontSize: 11, color: 'var(--fg-muted)', borderTop: '1px solid var(--border)' }}>
                &ldquo;Eliminar&rdquo; disponível apenas para empresas sem registos de ponto.
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── Modal: Nova empresa ── */}
      {showCreate && (
        <Modal title="Nova empresa" onClose={() => { setShowCreate(false); setErr('') }} width={620}>
          <form onSubmit={handleCreate} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            {err && <div className="alert-inline err">{err}</div>}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 10 }}>
              <div className="field">
                <label htmlFor="t-name">Nome</label>
                <input id="t-name" className="input" style={inputStyle} value={name} onChange={e => setName(e.target.value)} placeholder="Empresa A" required autoFocus />
              </div>
              <div className="field">
                <label htmlFor="t-slug">Slug (subdomínio)</label>
                <input id="t-slug" className="input" style={inputStyle} value={slug} onChange={e => setSlug(e.target.value)} placeholder="empresa-a" pattern="[a-z0-9]+(-[a-z0-9]+)*" minLength={2} maxLength={40} required />
              </div>
              <div className="field">
                <label htmlFor="t-domain">Domínio custom (opcional)</label>
                <input id="t-domain" className="input" style={inputStyle} value={domain} onChange={e => setDomain(e.target.value)} placeholder="ponto.empresa.com" />
              </div>
            </div>
            <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--fg-muted)', display: 'flex', alignItems: 'center', gap: 6 }}>
              <IconBuilding size={12} /> Admin inicial da empresa
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 10 }}>
              <div className="field">
                <label htmlFor="t-admin-name">Nome do admin</label>
                <input id="t-admin-name" className="input" style={inputStyle} value={adminName} onChange={e => setAdminName(e.target.value)} placeholder="Maria Silva" required />
              </div>
              <div className="field">
                <label htmlFor="t-admin-user">Usuário</label>
                <input id="t-admin-user" className="input" style={inputStyle} value={adminUsername} onChange={e => setAdminUsername(e.target.value)} placeholder="maria.silva" autoCapitalize="none" required />
              </div>
              <div className="field">
                <label htmlFor="t-admin-pwd">Senha (mín. 6)</label>
                <input id="t-admin-pwd" className="input" style={inputStyle} type="password" value={adminPassword} onChange={e => setAdminPassword(e.target.value)} minLength={6} required />
              </div>
            </div>
            <div style={{ display: 'flex', gap: 8, paddingTop: 4 }}>
              <button type="submit" className="btn primary" disabled={saving}>
                {saving ? 'A criar…' : 'Criar empresa'}
              </button>
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
            <div style={{ fontSize: 11, color: 'var(--fg-muted)' }}>
              Slug: <code>{editing.slug}</code> — não pode ser alterado
            </div>
            <div className="field">
              <label htmlFor="e-name">Nome</label>
              <input id="e-name" className="input" style={inputStyle} value={editName} onChange={e => setEditName(e.target.value)} required autoFocus />
            </div>
            <div className="field">
              <label htmlFor="e-domain">Domínio custom (vazio = remover)</label>
              <input id="e-domain" className="input" style={inputStyle} value={editDomain} onChange={e => setEditDomain(e.target.value)} placeholder="ponto.empresa.com" />
            </div>
            <div style={{ display: 'flex', gap: 8, paddingTop: 4 }}>
              <button type="submit" className="btn primary" disabled={saving}>{saving ? 'A guardar…' : 'Guardar'}</button>
              <button type="button" className="btn ghost" onClick={() => setEditing(null)}>Cancelar</button>
            </div>
          </form>
        </Modal>
      )}

      {/* ── Modal: Eliminar empresa ── */}
      {deleteTarget && (
        <Modal title="⚠ Eliminar permanentemente" onClose={() => { setDeleteTarget(null); setDeleteConfirm(''); setErr('') }} width={420}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div style={{ fontSize: 13, color: 'var(--fg-muted)', lineHeight: 1.6 }}>
              Esta acção é <strong>irreversível</strong>. Elimina a empresa <strong>{deleteTarget.name}</strong>,
              o seu admin e todos os dados associados.
              <br /><br />
              Escreve o nome exacto para confirmar:
            </div>
            <input
              className="input"
              style={{ height: 34 }}
              value={deleteConfirm}
              onChange={e => setDeleteConfirm(e.target.value)}
              placeholder={deleteTarget.name}
              autoFocus
            />
            {err && <div className="alert-inline err">{err}</div>}
            <div style={{ display: 'flex', gap: 8 }}>
              <button
                className="btn sm"
                disabled={deleteConfirm !== deleteTarget.name || deleting}
                onClick={handleDelete}
                style={{
                  background: deleteConfirm === deleteTarget.name ? 'var(--err-fg, #c53030)' : undefined,
                  color: deleteConfirm === deleteTarget.name ? '#fff' : undefined,
                  opacity: deleteConfirm !== deleteTarget.name ? 0.45 : 1,
                }}
              >
                {deleting ? 'A eliminar…' : 'Eliminar permanentemente'}
              </button>
              <button className="btn ghost sm" onClick={() => { setDeleteTarget(null); setDeleteConfirm(''); setErr('') }}>
                Cancelar
              </button>
            </div>
          </div>
        </Modal>
      )}

      {/* ── Modal: Separar plataforma ── */}
      {showSpinOff && defaultTenant && (
        <Modal
          title="⚠ Separar plataforma"
          onClose={() => { setShowSpinOff(false); setSpConfirm(''); setErr('') }}
          width={620}
        >
          <form onSubmit={handleSpinOff} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            {err && <div className="alert-inline err">{err}</div>}
            <div style={{ fontSize: 13, color: 'var(--fg-muted)', lineHeight: 1.6 }}>
              Move <strong>todos os dados</strong> de &quot;{defaultTenant.name}&quot; ({defaultTenant.employee_count} funcionário(s))
              para uma empresa própria — e cria uma conta de controlador separada aqui na plataforma.
              Esta acção é <strong>irreversível por esta ferramenta</strong> (reverter exigiria mover os dados de volta manualmente).
            </div>

            {!ROOT_DOMAIN && (
              <div className="alert-inline warn">
                ⚠ Sem <code>NEXT_PUBLIC_TENANT_ROOT_DOMAIN</code> configurado (#146): a nova empresa só vai conseguir
                fazer login se você informar um <strong>domínio custom</strong> abaixo — sem ele, os funcionários ficam
                sem forma de entrar (já aconteceu, ver #243). O domínio precisa estar de facto configurado na Vercel + DNS
                antes de confirmar (ver <code>docs/TENANTS.md</code>).
              </div>
            )}

            <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--fg-muted)', display: 'flex', alignItems: 'center', gap: 6 }}>
              <IconBuilding size={12} /> Nova empresa (recebe os dados operacionais)
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 10 }}>
              <div className="field">
                <label htmlFor="sp-name">Nome</label>
                <input id="sp-name" className="input" style={inputStyle} value={spName} onChange={e => setSpName(e.target.value)} placeholder={defaultTenant.name} required autoFocus />
              </div>
              <div className="field">
                <label htmlFor="sp-slug">Slug (subdomínio)</label>
                <input id="sp-slug" className="input" style={inputStyle} value={spSlug} onChange={e => setSpSlug(e.target.value)} placeholder="dac-industrial" pattern="[a-z0-9]+(-[a-z0-9]+)*" minLength={2} maxLength={40} required />
              </div>
              <div className="field">
                <label htmlFor="sp-domain">Domínio custom{ROOT_DOMAIN ? ' (opcional)' : ' — obrigatório sem root domain'}</label>
                <input id="sp-domain" className="input" style={inputStyle} value={spDomain} onChange={e => setSpDomain(e.target.value)} placeholder="ponto.empresa.com" required={!ROOT_DOMAIN} />
              </div>
            </div>

            <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--fg-muted)', display: 'flex', alignItems: 'center', gap: 6 }}>
              <IconUserPlus size={12} /> Nova conta de controlador (fica na plataforma)
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 10 }}>
              <div className="field">
                <label htmlFor="sp-ctrl-name">Nome</label>
                <input id="sp-ctrl-name" className="input" style={inputStyle} value={spControllerName} onChange={e => setSpControllerName(e.target.value)} placeholder="Dono da plataforma" required />
              </div>
              <div className="field">
                <label htmlFor="sp-ctrl-user">Usuário</label>
                <input id="sp-ctrl-user" className="input" style={inputStyle} value={spControllerUsername} onChange={e => setSpControllerUsername(e.target.value)} placeholder="platform-owner" autoCapitalize="none" required />
              </div>
              <div className="field">
                <label htmlFor="sp-ctrl-pwd">Senha (mín. 6)</label>
                <input id="sp-ctrl-pwd" className="input" style={inputStyle} type="password" value={spControllerPassword} onChange={e => setSpControllerPassword(e.target.value)} minLength={6} required />
              </div>
            </div>

            <div style={{ fontSize: 13, color: 'var(--fg-muted)' }}>
              Escreve o nome exacto de &quot;{defaultTenant.name}&quot; para confirmar:
            </div>
            <input
              className="input"
              style={{ height: 34 }}
              value={spConfirm}
              onChange={e => setSpConfirm(e.target.value)}
              placeholder={defaultTenant.name}
            />

            <div style={{ display: 'flex', gap: 8, paddingTop: 4 }}>
              <button
                type="submit"
                className="btn sm"
                disabled={spConfirm !== defaultTenant.name || spinningOff}
                style={{
                  background: spConfirm === defaultTenant.name ? 'var(--err-fg, #c53030)' : undefined,
                  color: spConfirm === defaultTenant.name ? '#fff' : undefined,
                  opacity: spConfirm !== defaultTenant.name ? 0.45 : 1,
                }}
              >
                {spinningOff ? 'A separar…' : 'Separar plataforma'}
              </button>
              <button type="button" className="btn ghost sm" onClick={() => { setShowSpinOff(false); setSpConfirm(''); setErr('') }}>
                Cancelar
              </button>
            </div>
          </form>
        </Modal>
      )}
    </>
  )
}
