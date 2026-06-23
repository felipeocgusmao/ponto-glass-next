'use client'

import { useEffect, useRef } from 'react'
import type { ReactNode } from 'react'

interface Props {
  title: string
  onClose: () => void
  children: ReactNode
  width?: number
}

export function Modal({ title, onClose, children, width = 560 }: Props) {
  const panelRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [onClose])

  return (
    <div
      className="modal-glass-overlay"
      onMouseDown={e => { if (e.target === e.currentTarget) onClose() }}
    >
      <div
        ref={panelRef}
        className="modal-glass-panel"
        style={{ maxWidth: width }}
      >
        <div className="modal-glass-head">
          <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--fg)' }}>{title}</span>
          <button
            onClick={onClose}
            className="btn ghost sm icon"
            aria-label="Fechar"
          >
            ✕
          </button>
        </div>
        <div className="modal-glass-body">
          {children}
        </div>
      </div>
    </div>
  )
}
