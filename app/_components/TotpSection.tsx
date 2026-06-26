'use client'

import { useEffect, useState } from 'react'
import { useLang } from '@/lib/LangContext'

type Status = 'loading' | 'off' | 'enrolling' | 'on'

// Self-service TOTP management, mounted in the admin Settings modal and the
// /ponto profile. Talks to /api/auth/totp; QR rendered client-side from the
// otpauth URI (the secret never goes through a third-party chart service).
export function TotpSection() {
  const { t } = useLang()
  const [status, setStatus] = useState<Status>('loading')
  const [qr, setQr] = useState('')          // data URL
  const [secret, setSecret] = useState('')  // manual-entry fallback
  const [code, setCode] = useState('')
  const [err, setErr] = useState('')
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    fetch('/api/auth/totp')
      .then(r => r.json())
      .then(d => setStatus(d.enabled ? 'on' : 'off'))
      .catch(() => setStatus('off'))
  }, [])

  const begin = async () => {
    setBusy(true); setErr('')
    try {
      const res = await fetch('/api/auth/totp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'setup' }),
      })
      const data = await res.json()
      if (!res.ok) { setErr(data.error ?? t('totp.err.generic')); return }
      const QRCode = (await import('qrcode')).default
      setQr(await QRCode.toDataURL(data.uri, { margin: 1, width: 180 }))
      setSecret(data.secret)
      setCode('')
      setStatus('enrolling')
    } catch { setErr(t('totp.err.connect')) }
    finally { setBusy(false) }
  }

  const submitCode = async (action: 'enable' | 'disable') => {
    setBusy(true); setErr('')
    try {
      const res = await fetch('/api/auth/totp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, code }),
      })
      const data = await res.json()
      if (!res.ok) { setErr(data.error ?? t('totp.err.invalid')); return }
      setCode(''); setQr(''); setSecret('')
      setStatus(action === 'enable' ? 'on' : 'off')
    } catch { setErr(t('totp.err.connect')) }
    finally { setBusy(false) }
  }

  const codeInput = (
    <input className="input tnum" value={code} inputMode="numeric" placeholder="000000"
      autoComplete="one-time-code"
      onChange={e => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
      style={{ height: 36, textAlign: 'center', letterSpacing: '0.25em', maxWidth: 140 }} />
  )

  if (status === 'loading') return <div style={{ fontSize: 12, color: 'var(--fg-muted)' }}>{t('totp.loading')}</div>

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      {status === 'off' && (
        <>
          <div style={{ fontSize: 12, color: 'var(--fg-muted)' }}>
            {t('totp.protect_hint')}
          </div>
          <button className="btn primary sm" onClick={begin} disabled={busy} style={{ alignSelf: 'flex-start' }}>
            {busy ? t('totp.preparing') : t('totp.enable')}
          </button>
        </>
      )}

      {status === 'enrolling' && (
        <>
          <div style={{ fontSize: 12, color: 'var(--fg-muted)' }}>
            {t('totp.enroll_hint')}
          </div>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          {qr && <img src={qr} alt="QR code" width={180} height={180} style={{ borderRadius: 8, alignSelf: 'center' }} />}
          <div className="mono" style={{ fontSize: 10, color: 'var(--fg-subtle)', wordBreak: 'break-all', textAlign: 'center' }}>
            {t('totp.manual_key')} {secret}
          </div>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', justifyContent: 'center' }}>
            {codeInput}
            <button className="btn primary sm" disabled={busy || code.length !== 6} onClick={() => submitCode('enable')}>
              {t('totp.confirm')}
            </button>
          </div>
        </>
      )}

      {status === 'on' && (
        <>
          <div className="alert-inline ok" style={{ fontSize: 12 }}>{t('totp.active')}</div>
          <div style={{ fontSize: 12, color: 'var(--fg-muted)' }}>{t('totp.disable_hint')}</div>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            {codeInput}
            <button className="btn ghost sm danger" disabled={busy || code.length !== 6} onClick={() => submitCode('disable')}>
              {t('totp.disable')}
            </button>
          </div>
        </>
      )}

      {err && <div className="alert-inline err" style={{ fontSize: 12 }}>{err}</div>}
    </div>
  )
}
