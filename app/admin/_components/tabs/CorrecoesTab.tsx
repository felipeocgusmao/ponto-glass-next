'use client'

import { useState, useEffect, useCallback } from 'react'
import type { CorrectionRequest } from '@/lib/types'
import { SL } from '../../_lib/helpers'
import { useLang } from '@/lib/LangContext'
import type { TranslationKey } from '@/lib/i18n'
import { IconRefresh } from '../icons'

interface CompensationRequest {
  id: string
  employee_name: string
  date: string
  hours_requested: number
  reason: string
  status: 'pending' | 'approved' | 'rejected'
  reviewer_note: string | null
  created_at: string
}

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

  // Compensation requests
  const [compItems, setCompItems] = useState<CompensationRequest[]>([])
  const [compLoading, setCompLoading] = useState(true)
  const [compActionId, setCompActionId] = useState<string | null>(null)
  const [compRejectNote, setCompRejectNote] = useState('')
  const [compRejectTarget, setCompRejectTarget] = useState<string | null>(null)
  const [compActErr, setCompActErr] = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/correction-requests')
      if (res.ok) setItems(await res.json())
    } catch { /* silent */ }
    finally { setLoading(false) }
  }, [])

  const loadComp = useCallback(async () => {
    setCompLoading(true)
    try {
      const res = await fetch('/api/compensation-requests')
      if (res.ok) setCompItems(await res.json())
    } catch { /* silent */ }
    finally { setCompLoading(false) }
  }, [])

  useEffect(() => { load(); loadComp() }, [load, loadComp])

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
        setActErr(d.error ?? t('corr.err.generic'))
      }
    } catch { setActErr(t('corr.err.connect')) }
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

  const actComp = async (id: string, action: 'approve' | 'reject', note?: string) => {
    setCompActionId(id); setCompActErr('')
    try {
      const res = await fetch(`/api/compensation-requests/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, note }),
      })
      if (res.ok) {
        setCompRejectTarget(null); setCompRejectNote('')
        await loadComp()
        // The sidebar badge counts compensations too — refresh it like `act` does.
        onAction?.()
      } else {
        const d = await res.json().catch(() => ({}))
        setCompActErr(d.error ?? t('corr.err.generic'))
      }
    } catch { setCompActErr(t('corr.err.connect')) }
    finally { setCompActionId(null) }
  }

  const pending = items.filter(i => i.status === 'pending')
  const resolved = items.filter(i => i.status !== 'pending')
  const compPending = compItems.filter(i => i.status === 'pending')
  const compResolved = compItems.filter(i => i.status !== 'pending')

  const pageHead = (
    <div className="page-head">
      <div>
        <div className="page-title">{t('tab.correcoes')}</div>
        <div className="page-sub">
          {loading
            ? t('common.loading')
            : (() => {
                const totalPending = pending.length + compPending.length
                return totalPending > 0
                  ? `${totalPending} ${totalPending === 1 ? 'pedido pendente' : 'pedidos pendentes'}`
                  : 'Sem pedidos pendentes'
              })()}
        </div>
      </div>
      <div className="page-actions">
        <button className="btn" onClick={load}><IconRefresh size={13}/> Atualizar</button>
      </div>
    </div>
  )

  if (loading) return (
    <>
      {pageHead}
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
    </>
  )

  return (
    <>
      {pageHead}
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
                      &ldquo;{cr.reason}&rdquo;
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
                    <div style={{ marginTop: 4, padding: '5px 9px', background: cr.status === 'rejected' ? 'rgba(239,68,68,0.07)' : 'var(--surface-2)', borderRadius: 'var(--r-sm)', borderLeft: `2px solid ${cr.status === 'rejected' ? 'var(--danger-fg)' : 'var(--accent)'}`, fontSize: 11, color: cr.status === 'rejected' ? 'var(--danger-fg)' : 'var(--fg-muted)' }}>
                      {t('corr.reviewer_note')}: {cr.reviewer_note}
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

      {/* ── COMPENSATION REQUESTS ────────────────────────────────────────── */}
      <div className="card">
        <div style={{ padding: '16px 20px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
            <SL style={{ margin: 0 }}>{t('admin.comp.title')} {compPending.length > 0 && `· ${compPending.length}`}</SL>
            <button className="btn" onClick={loadComp}><IconRefresh size={13}/></button>
          </div>

          {compActErr && <div className="alert-inline err" style={{ marginBottom: 8 }}>{compActErr}</div>}

          {compLoading
            ? <div style={{ color: 'var(--fg-muted)', fontSize: 13 }}>{t('common.loading')}</div>
            : compPending.length === 0
              ? <div className="alert-inline ok">{t('admin.comp.none_pending')}</div>
              : compPending.map(cr => (
                <div key={cr.id} style={{ padding: '14px 0', borderBottom: '1px solid var(--border)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12, marginBottom: 8 }}>
                    <div>
                      <div style={{ fontSize: 13, fontWeight: 600 }}>{cr.employee_name}</div>
                      <div style={{ fontSize: 12, color: 'var(--fg-muted)', marginTop: 2 }}>
                        {fmtDate(cr.date)} · {cr.hours_requested}h
                      </div>
                      {cr.reason && <div style={{ fontSize: 12, color: 'var(--fg-muted)', marginTop: 4, fontStyle: 'italic' }}>&ldquo;{cr.reason}&rdquo;</div>}
                      <div style={{ fontSize: 10, color: 'var(--fg-subtle)', marginTop: 4 }}>
                        {t('admin.comp.requested_at')} {fmtTs(cr.created_at)}
                      </div>
                    </div>
                    <span className="chip warn" style={{ fontSize: 10, flexShrink: 0 }}>{t('comp.status.pending')}</span>
                  </div>
                  {compRejectTarget === cr.id ? (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                      <input
                        className="input"
                        placeholder={t('admin.comp.reject_note')}
                        value={compRejectNote}
                        onChange={e => setCompRejectNote(e.target.value)}
                        style={{ fontSize: 12 }}
                      />
                      <div style={{ display: 'flex', gap: 8 }}>
                        <button className="btn danger sm" disabled={!!compActionId} onClick={() => actComp(cr.id, 'reject', compRejectNote)} style={{ flex: 1, justifyContent: 'center' }}>
                          {compActionId === cr.id ? t('admin.comp.rejecting') : t('admin.comp.confirm_reject')}
                        </button>
                        <button className="btn ghost sm" onClick={() => setCompRejectTarget(null)}>{t('common.cancel')}</button>
                      </div>
                    </div>
                  ) : (
                    <div style={{ display: 'flex', gap: 8 }}>
                      <button className="btn primary sm" disabled={!!compActionId} onClick={() => actComp(cr.id, 'approve')} style={{ flex: 1, justifyContent: 'center' }}>
                        {compActionId === cr.id ? t('admin.comp.approving') : '✓ ' + t('common.approve')}
                      </button>
                      <button className="btn ghost sm" disabled={!!compActionId} onClick={() => { setCompRejectTarget(cr.id); setCompRejectNote('') }} style={{ flex: 1, justifyContent: 'center' }}>
                        {'✕ ' + t('common.reject')}
                      </button>
                    </div>
                  )}
                </div>
              ))
          }

          {compResolved.length > 0 && (
            <>
              <SL style={{ marginTop: 20 }}>{t('admin.comp.history')}</SL>
              {compResolved.map(cr => (
                <div key={cr.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12, padding: '10px 0', borderBottom: '1px solid var(--border)' }}>
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontSize: 13, fontWeight: 500 }}>{cr.employee_name}</div>
                    <div style={{ fontSize: 11, color: 'var(--fg-muted)', marginTop: 2 }}>
                      {fmtDate(cr.date)} · {cr.hours_requested}h
                    </div>
                    {cr.reviewer_note && (
                      <div style={{ marginTop: 4, padding: '5px 9px', background: cr.status === 'rejected' ? 'rgba(239,68,68,0.07)' : 'var(--surface-2)', borderRadius: 'var(--r-sm)', borderLeft: `2px solid ${cr.status === 'rejected' ? 'var(--danger-fg)' : 'var(--accent)'}`, fontSize: 11, color: cr.status === 'rejected' ? 'var(--danger-fg)' : 'var(--fg-muted)' }}>
                        {t('corr.reviewer_note')}: {cr.reviewer_note}
                      </div>
                    )}
                  </div>
                  <span className={`chip ${cr.status === 'approved' ? 'success' : 'danger'}`} style={{ fontSize: 10, flexShrink: 0 }}>
                    {cr.status === 'approved' ? t('comp.status.approved') : t('comp.status.rejected')}
                  </span>
                </div>
              ))}
            </>
          )}
        </div>
      </div>
    </>
  )
}
