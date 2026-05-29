'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import type { AuditLog } from '@/lib/types'
import { AUDIT_LABELS } from '../../_lib/types'
import { useLang } from '@/lib/LangContext'
import type { TranslationKey } from '@/lib/i18n'
import { IconRefresh, IconSearch, IconDownload } from '../icons'

function fmtRelative(iso: string): string {
  const now = Date.now()
  const t = new Date(iso).getTime()
  const diff = Math.floor((now - t) / 1000)
  if (diff < 60) return 'agora'
  if (diff < 3600) return `${Math.floor(diff / 60)}min`
  if (diff < 86400) return `${Math.floor(diff / 3600)}h`
  if (diff < 86400 * 7) return `${Math.floor(diff / 86400)}d`
  return new Date(iso).toLocaleDateString('pt-PT', { day: '2-digit', month: 'short' })
}

export function AuditoriaTab() {
  const { t } = useLang()
  const [logs, setLogs] = useState<AuditLog[]>([])
  const [loading, setLoading] = useState(true)
  const [actionFilter, setActionFilter] = useState('all')
  const [actorFilter, setActorFilter] = useState('all')
  const [search, setSearch] = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams({ limit: '200' })
      if (actionFilter !== 'all') params.set('action', actionFilter)
      const res = await fetch(`/api/audit?${params}`)
      if (res.ok) setLogs(await res.json())
    } catch { /* silent */ }
    finally { setLoading(false) }
  }, [actionFilter])

  useEffect(() => { load() }, [load])

  const auditLabel = (action: string): string =>
    t(('audit.action.' + action) as TranslationKey) || action

  const actors = useMemo(() => {
    const set = new Map<string, string>()
    logs.forEach(l => { if (l.actor_id) set.set(l.actor_id, l.actor_name) })
    return Array.from(set.entries()).sort((a, b) => a[1].localeCompare(b[1]))
  }, [logs])

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    return logs.filter(l => {
      if (actorFilter !== 'all' && l.actor_id !== actorFilter) return false
      if (q) {
        const hay = `${l.actor_name} ${l.action} ${l.target_name ?? ''} ${auditLabel(l.action)}`.toLowerCase()
        if (!hay.includes(q)) return false
      }
      return true
    })
    // auditLabel uses t() which is stable in the closure for this render — safe to omit
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [logs, actorFilter, search])

  const exportJSON = () => {
    const data = filtered.map(l => ({
      id: l.id,
      created_at: l.created_at,
      actor_id: l.actor_id,
      actor_name: l.actor_name,
      action: l.action,
      target_id: l.target_id,
      target_name: l.target_name,
      details: l.details,
    }))
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `audit_${new Date().toISOString().slice(0, 10)}.json`
    a.click()
    URL.revokeObjectURL(url)
  }

  const fmtDetails = (d: AuditLog['details']): string => {
    if (!d || typeof d !== 'object' || Object.keys(d).length === 0) return ''
    return Object.entries(d).map(([k, v]) => `${k}=${String(v)}`).join(' · ')
  }

  return (
    <>
      {/* Page header */}
      <div className="page-head">
        <div>
          <div className="page-title">{t('tab.auditoria')}</div>
          <div className="page-sub">
            Trilha de alterações administrativas
            {!loading && logs.length > 0 ? ` · últimos ${logs.length}` : ''}
          </div>
        </div>
        <div className="page-actions">
          {filtered.length > 0 && (
            <button onClick={exportJSON} className="btn"><IconDownload size={13}/> JSON</button>
          )}
          <button className="btn" onClick={load}><IconRefresh size={13}/> Atualizar</button>
        </div>
      </div>

      {/* Filter bar */}
      <div className="card">
        <div style={{ padding: '12px 16px', display: 'flex', flexWrap: 'wrap', gap: 10, alignItems: 'center' }}>
          <div style={{ position: 'relative', flex: '1 1 240px', maxWidth: 320 }}>
            <span style={{ position: 'absolute', left: 8, top: '50%', transform: 'translateY(-50%)', color: 'var(--fg-subtle)', display: 'inline-flex' }}>
              <IconSearch size={13} />
            </span>
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Buscar por ação, ator ou alvo…"
              className="input search"
              style={{ width: '100%' }}
            />
          </div>
          <select value={actionFilter} onChange={e => setActionFilter(e.target.value)} className="input" style={{ width: 'auto' }}>
            <option value="all">{t('audit.all_actions')}</option>
            {Object.keys(AUDIT_LABELS).map(k => (
              <option key={k} value={k}>{auditLabel(k)}</option>
            ))}
          </select>
          <select value={actorFilter} onChange={e => setActorFilter(e.target.value)} className="input" style={{ width: 'auto' }}>
            <option value="all">Todos atores</option>
            {actors.map(([id, name]) => (
              <option key={id} value={id}>{name}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Table */}
      <div className="card">
        {loading ? (
          <div className="empty"><div className="title">{t('common.loading')}</div></div>
        ) : filtered.length === 0 ? (
          <div className="empty">
            <div className="title">{logs.length === 0 ? t('audit.none') : 'Nenhum registro corresponde'}</div>
            {logs.length > 0 && <div className="desc">Ajuste a busca ou os filtros.</div>}
          </div>
        ) : (
          <table className="table">
            <thead>
              <tr>
                <th style={{ width: 90 }}>Quando</th>
                <th style={{ width: 180 }}>Ator</th>
                <th>Ação</th>
                <th>Alvo</th>
                <th>Detalhes</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(log => (
                <tr key={log.id}>
                  <td className="muted tnum" style={{ fontSize: 12 }} title={new Date(log.created_at).toLocaleString('pt-PT')}>
                    {fmtRelative(log.created_at)}
                  </td>
                  <td style={{ fontSize: 13 }}>{log.actor_name}</td>
                  <td>
                    <div style={{ fontSize: 13 }}>{auditLabel(log.action)}</div>
                    <div className="mono muted" style={{ fontSize: 11 }}>{log.action}</div>
                  </td>
                  <td style={{ fontSize: 13 }}>{log.target_name || <span className="muted">—</span>}</td>
                  <td className="muted mono" style={{ fontSize: 11.5, wordBreak: 'break-all' }}>
                    {fmtDetails(log.details) || '—'}
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
