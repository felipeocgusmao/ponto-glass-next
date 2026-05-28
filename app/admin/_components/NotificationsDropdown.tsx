'use client'

import { useEffect, useRef } from 'react'
import type { Tab } from '../_lib/types'
import type { Notif, NotifKind } from '../_lib/useNotifications'
import { IconEdit, IconAlertTriangle, IconUsers, IconX, IconArrowRight } from './icons'

export default function NotificationsDropdown({
  open,
  onClose,
  onNavigate,
  items,
}: {
  open: boolean
  onClose: () => void
  onNavigate: (tab: Tab) => void
  items: Notif[]
}) {
  const popRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const onDown = (e: MouseEvent) => {
      if (popRef.current && !popRef.current.contains(e.target as Node)) onClose()
    }
    const onEsc = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    // Defer to avoid catching the same click that opened the popover.
    const t = setTimeout(() => document.addEventListener('mousedown', onDown), 0)
    document.addEventListener('keydown', onEsc)
    return () => {
      clearTimeout(t)
      document.removeEventListener('mousedown', onDown)
      document.removeEventListener('keydown', onEsc)
    }
  }, [open, onClose])

  if (!open) return null

  const iconFor = (kind: NotifKind) =>
    kind === 'corrections' ? <IconEdit size={14} />
    : kind === 'missing_exit' ? <IconAlertTriangle size={14} />
    : <IconUsers size={14} />

  const toneFor = (kind: NotifKind) =>
    kind === 'corrections' ? 'accent'
    : kind === 'missing_exit' ? 'warn'
    : 'muted'

  return (
    <div ref={popRef} className="notif-pop" role="dialog" aria-label="Notificações">
      <div className="notif-head">
        <span style={{ fontWeight: 600, fontSize: 13 }}>Notificações</span>
        <span style={{ color: 'var(--fg-subtle)', fontSize: 11.5 }}>
          {items.length === 0 ? 'Tudo em ordem' : `${items.length} ${items.length === 1 ? 'item' : 'itens'}`}
        </span>
        <button className="btn ghost sm icon" onClick={onClose} title="Fechar" style={{ marginLeft: 'auto' }}>
          <IconX size={12} />
        </button>
      </div>
      {items.length === 0 ? (
        <div className="notif-empty">
          <div className="notif-empty-emoji">✓</div>
          <div className="notif-empty-title">Sem notificações</div>
          <div className="notif-empty-sub">Não há pedidos pendentes nem alertas hoje.</div>
        </div>
      ) : (
        <div className="notif-list">
          {items.map(n => (
            <button
              key={n.id}
              className="notif-item"
              onClick={() => { onNavigate(n.tab); onClose() }}
            >
              <span className={`notif-icon ${toneFor(n.kind)}`}>{iconFor(n.kind)}</span>
              <span className="notif-body">
                <span className="notif-title">{n.title}</span>
                <span className="notif-desc">{n.description}</span>
              </span>
              <span className="notif-arrow"><IconArrowRight size={11} /></span>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
