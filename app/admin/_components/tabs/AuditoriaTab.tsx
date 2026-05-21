'use client'

import { useState, useEffect, useCallback } from 'react'
import type { AuditLog } from '@/lib/types'
import { SL } from '../../_lib/helpers'
import { AUDIT_LABELS } from '../../_lib/types'

export function AuditoriaTab() {
  const [logs, setLogs] = useState<AuditLog[]>([])
  const [loading, setLoading] = useState(true)
  const [actionFilter, setActionFilter] = useState('all')

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

  return (
    <>
      <div className="card">
        <div style={{ padding: '16px 20px' }}>
          <SL>Filtro</SL>
          <div className="field" style={{ marginTop: 4 }}>
            <label>Ação</label>
            <select value={actionFilter} onChange={e => setActionFilter(e.target.value)} className="input">
              <option value="all">Todas as ações</option>
              {Object.entries(AUDIT_LABELS).map(([k, v]) => (
                <option key={k} value={k}>{v}</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      <div className="card">
        <div style={{ padding: '16px 20px' }}>
          {loading
            ? <div className="alert-inline info">Carregando...</div>
            : logs.length === 0
            ? <div className="alert-inline info">Nenhum registo de auditoria.</div>
            : (
              <>
                <SL>{logs.length} evento(s)</SL>
                {logs.map(log => (
                  <div key={log.id} style={{ padding: '10px 0', borderBottom: '1px solid var(--border)' }}>
                    <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--fg)' }}>
                      {AUDIT_LABELS[log.action] ?? log.action}
                      {log.target_name && <span style={{ fontWeight: 400, color: 'var(--fg-muted)' }}> — {log.target_name}</span>}
                    </div>
                    <div style={{ fontSize: 11, color: 'var(--fg-muted)', marginTop: 3 }}>
                      por {log.actor_name} · {new Date(log.created_at).toLocaleString('pt-BR')}
                    </div>
                  </div>
                ))}
              </>
            )
          }
        </div>
      </div>
    </>
  )
}
