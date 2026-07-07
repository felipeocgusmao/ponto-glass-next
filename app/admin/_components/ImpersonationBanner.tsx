'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'

// Shown when a super-admin is impersonating a company — lets them exit back to
// the platform without logging out completely.
export default function ImpersonationBanner() {
  const [active, setActive] = useState(false)
  const [exiting, setExiting] = useState(false)
  const router = useRouter()

  useEffect(() => {
    // The backup cookie is httpOnly so we can't read it from JS.
    // Instead, ping a lightweight endpoint to check if we're impersonating.
    fetch('/api/tenants/impersonate-status').then(r => {
      if (r.ok) r.json().then(d => setActive(d.impersonating === true))
    }).catch(() => {})
  }, [])

  if (!active) return null

  const handleExit = async () => {
    setExiting(true)
    try {
      await fetch('/api/tenants/impersonate-status', { method: 'DELETE' })
      router.push('/admin')
      router.refresh()
    } catch { setExiting(false) }
  }

  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      gap: 12,
      padding: '8px 14px',
      marginBottom: 12,
      background: 'color-mix(in srgb, var(--accent, #5e6ad2) 12%, transparent)',
      border: '1px solid color-mix(in srgb, var(--accent, #5e6ad2) 30%, transparent)',
      borderRadius: 'var(--r-md, 8px)',
      fontSize: 13,
    }}>
      <span style={{ flex: 1 }}>
        🔍 <strong>Modo impersonation</strong> — estás a ver o painel desta empresa como admin.
      </span>
      <button
        className="btn ghost sm"
        onClick={handleExit}
        disabled={exiting}
        style={{ whiteSpace: 'nowrap' }}
      >
        {exiting ? '…' : '← Voltar à plataforma'}
      </button>
    </div>
  )
}
