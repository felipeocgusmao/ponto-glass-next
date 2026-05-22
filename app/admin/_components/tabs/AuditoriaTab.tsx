'use client'

import { useState, useEffect, useCallback } from 'react'
import type { AuditLog } from '@/lib/types'
import { SL } from '../../_lib/helpers'
import { AUDIT_LABELS } from '../../_lib/types'
import { useLang } from '@/lib/LangContext'
import type { TranslationKey } from '@/lib/i18n'

export function AuditoriaTab() {
  const { t } = useLang()
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

  const auditLabel = (action: string): string =>
    t(('audit.action.' + action) as TranslationKey) || action

  return (
    <>
      <div className="card">
        <div style={{ padding: '16px 20px' }}>
          <SL>{t('audit.filter')}</SL>
          <div className="field" style={{ marginTop: 4 }}>
            <label>{t('audit.action_label')}</label>
            <select value={actionFilter} onChange={e => setActionFilter(e.target.value)} className="input">
              <option value="all">{t('audit.all_actions')}</option>
              {Object.keys(AUDIT_LABELS).map(k => (
                <option key={k} value={k}>{auditLabel(k)}</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      <div className="card">
        <div style={{ padding: '16px 20px' }}>
          {loading
            ? <div className="alert-inline info">{t('common.loading')}</div>
            : logs.length === 0
            ? <div className="alert-inline info">{t('audit.none')}</div>
            : (
              <>
                <SL>{logs.length} {t('common.records')}</SL>
                {logs.map(log => (
                  <div key={log.id} style={{ padding: '10px 0', borderBottom: '1px solid var(--border)' }}>
                    <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--fg)' }}>
                      {auditLabel(log.action)}
                      {log.target_name && <span style={{ fontWeight: 400, color: 'var(--fg-muted)' }}> — {log.target_name}</span>}
                    </div>
                    <div style={{ fontSize: 11, color: 'var(--fg-muted)', marginTop: 3 }}>
                      {t('audit.by')} {log.actor_name} · {new Date(log.created_at).toLocaleString('pt-BR')}
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
