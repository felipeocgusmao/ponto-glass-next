'use client'

import { useState, useEffect, useCallback } from 'react'
import type { CorrectionRequest } from '@/lib/types'
import { SL } from '../../_lib/helpers'
import { useLang } from '@/lib/LangContext'
import type { TranslationKey } from '@/lib/i18n'

function fmtTs(ts: string) {
  const d = new Date(ts)
  return d.toLocaleString('pt-PT', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })
}

function fmtDate(d: string) {
  const [y, m, day] = d.split('-')
  return `${day}/${m}/${y}`
}

export function CorrecoesTab({ onAction }: { onAction?: () => void }) {
  const { t } = useLang()
  const [items, setItems] = useState<CorrectionRequest[]>([])
  const [loading, setLoading] = useState(true)
  const [actionId, setActionId] = useState<string | null>(null)
  const [rejectNote, setRejectNote] = useState('')
  const [rejectTarget, setRejectTarget] = useState<string | null>(null)
  const [bulkApproving, setBulkApproving] = useState(false)
  const [bulkMsg, setBulkMsg] = useState<{ ok: boolean; text: string } | null>(null)
  const [actErr, setActErr] = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/correction-requests')
      if (res.ok) setItems(await res.json())
    } catch { /* silent */ }
    finally { setLoading(false) }
  }, [])

  useEffect(() => { load() }, [load])

  const act = async (id: string, action: 'approve' | 'reject', note?: string) => {
    setActionId(id)
    setActErr('')
    try {
      const res = await fetch(`/api/correction-requests/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, note }),
      })
      if (res.ok) {
        setRejectTarget(null)
        setRejectNote('')
        await load()
        onAction?.()
        // Approving inserts a punch record — refresh the missing-exit banner.
        if (action === 'approve') window.dispatchEvent(new Event('pg:records-changed'))
      } else {
        const d = await res.json().catch(() => ({}))
        setActErr(d.error ?? 'Falha ao processar o pedido. Tente novamente.')
      }
    } catch { setActErr('Erro de conexão. Tente novamente.') }
    finally { setActionId(null) }
  }

  const approveAll = async () => {
    if (!confirm(`Aprovar todas as ${pending.length} correcções pendentes?`)) return
    setBulkApproving(true)
    setBulkMsg(null)
    let ok = 0, fail = 0
    for (const cr of pending) {
      try {
        const res = await fetch(`/api/correction-requests/${cr.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'approve' }),
        })
        if (res.ok) ok++; else fail++
      } catch { fail++ }
    }
    await load()
    onAction?.()
    if (ok > 0) window.dispatchEvent(new Event('pg:records-changed'))
    setBulkApproving(false)
    setBulkMsg(fail === 0
      ? { ok: true, text: `${ok} correcção(ões) aprovada(s).` }
      : { ok: false, text: `${ok} aprovada(s), ${fail} falharam. Tenta novamente.` })
  }

  const pending = items.filter(i => i.status === 'pending')
  const resolved = items.filter(i => i.status !== 'pending')

  if (loading) return (
    <div className="card">
      <div style={{ padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: 12 }}>
        {[0,1,2].map(i => (
          <div key={i} style={{ padding: '14px 0', borderBottom: '1px solid var(--border)', display: 'flex', flexDirection: 'column', gap: 8 }}>
            <div className="skeleton skeleton-title" style={{ width: '40%' }} />
            <div className="skeleton skeleton-text" style={{ width: '60%' }} />
            <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
              <div className="skeleton" style={{ height: 28, flex: 1, borderRadius: 'var(--r-sm)' }} />
              <div className="skeleton" style={{ height: 28, flex: 1, borderRadius: 'var(--r-sm)' }} />
            </div>
          </div>
        ))}
      </div>
    </div>
  )

  return (
    <>
      {/* ── PENDING ─────────────────────────────────────────────────────── */}
      <div className="card">
        <div style={{ padding: '16px 20px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
            <SL style={{ margin: 0 }}>{t('admin.corr.pending')} {pending.length > 0 && `· ${pending.length}`}</SL>
            {pending.length > 1 && (
              <button onClick={approveAll} disabled={bulkApproving || !!actionId} className="btn primary sm">
                {bulkApproving ? 'A aprovar…' : `✓ Aprovar todas (${pending.length})`}
              </button>
            )}
          </div>

          {bulkMsg && (
            <div className={`alert-inline ${bulkMsg.ok ? 'ok' : 'err'}`} style={{ marginBottom: 8 }}>{bulkMsg.text}</div>
          )}

          {actErr && (
            <div className="alert-inline err" style={{ marginBottom: 8 }}>{actErr}</div>
          )}

          {pending.length === 0 && (
            <div className="alert-inline ok" style={{ marginTop: 8 }}>{t('admin.corr.none_pending')}</div>
          )}

          {pending.map(cr => (
            <div key={cr.id} style={{ padding: '14px 0', borderBottom: '1px solid var(--border)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12, marginBottom: 8 }}>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--fg)' }}>{cr.employee_name}</div>
                  <div style={{ fontSize: 12, color: 'var(--fg-muted)', marginTop: 2 }}>
                    <span className="chip outline" style={{ fontSize: 10, marginRight: 6 }}>{t(('punch.' + cr.req_type) as TranslationKey) ?? cr.req_type}</span>
                    {fmtTs(cr.req_timestamp)}
                  </div>
                  {cr.reason && (
                    <div style={{ fontSize: 12, color: 'var(--fg-muted)', marginTop: 4, fontStyle: 'italic' }}>
                      "{cr.reason}"
                    </div>
                  )}
                  <div style={{ fontSize: 10, color: 'var(--fg-subtle)', marginTop: 4 }}>
                    {t('admin.corr.requested_at')} {fmtTs(cr.created_at)}
                  </div>
                </div>
                <span className="chip warn" style={{ fontSize: 10, flexShrink: 0 }}>{t('corr.status.pending')}</span>
              </div>

              {rejectTarget === cr.id ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  <input
                    className="input"
                    placeholder={t('admin.corr.reject_note')}
                    value={rejectNote}
                    onChange={e => setRejectNote(e.target.value)}
                    style={{ fontSize: 12 }}
                  />
                  <div style={{ display: 'flex', gap: 8 }}>
                    <button
                      className="btn danger sm"
                      disabled={!!actionId}
                      onClick={() => act(cr.id, 'reject', rejectNote)}
                      style={{ flex: 1, justifyContent: 'center' }}
                    >
                      {actionId === cr.id ? t('admin.corr.rejecting') : t('admin.corr.confirm_reject')}
                    </button>
                    <button className="btn ghost sm" onClick={() => setRejectTarget(null)}>{t('common.cancel')}</button>
                  </div>
                </div>
              ) : (
                <div style={{ display: 'flex', gap: 8 }}>
                  <button
                    className="btn primary sm"
                    disabled={!!actionId}
                    onClick={() => act(cr.id, 'approve')}
                    style={{ flex: 1, justifyContent: 'center' }}
                  >
                    {actionId === cr.id ? t('admin.corr.approving') : '✓ ' + t('common.approve')}
                  </button>
                  <button
                    className="btn ghost sm"
                    disabled={!!actionId}
                    onClick={() => { setRejectTarget(cr.id); setRejectNote('') }}
                    style={{ flex: 1, justifyContent: 'center' }}
                  >
                    {'✕ ' + t('common.reject')}
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* ── RESOLVED ────────────────────────────────────────────────────── */}
      {resolved.length > 0 && (
        <div className="card">
          <div style={{ padding: '16px 20px' }}>
            <SL>{t('admin.corr.history')}</SL>
            {resolved.map(cr => (
              <div key={cr.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12, padding: '10px 0', borderBottom: '1px solid var(--border)' }}>
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--fg)' }}>{cr.employee_name}</div>
                  <div style={{ fontSize: 11, color: 'var(--fg-muted)', marginTop: 2 }}>
                    {t(('punch.' + cr.req_type) as TranslationKey) ?? cr.req_type} · {fmtDate(cr.req_date)} · {new Date(cr.req_timestamp).toLocaleTimeString('pt-PT', { hour: '2-digit', minute: '2-digit' })}
                  </div>
                  {cr.reviewer_note && (
                    <div style={{ fontSize: 11, color: 'var(--fg-subtle)', marginTop: 2, fontStyle: 'italic' }}>
                      {t('corr.reviewer_note')}: "{cr.reviewer_note}"
                    </div>
                  )}
                </div>
                <span className={`chip ${cr.status === 'approved' ? 'success' : 'danger'}`} style={{ fontSize: 10, flexShrink: 0 }}>
                  {cr.status === 'approved' ? t('corr.status.approved') : t('corr.status.rejected')}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </>
  )
}
