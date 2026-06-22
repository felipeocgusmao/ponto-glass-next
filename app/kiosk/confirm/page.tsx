'use client'

import { useState, useEffect, Suspense } from 'react'
import { useSearchParams } from 'next/navigation'

type PunchType = 'entrada' | 'saída' | 'inicio_almoco' | 'fim_almoco' | 'pausa_cafe' | 'retorno_cafe'

const PUNCH_OPTIONS: { type: PunchType; tone: string; label: string }[] = [
  { type: 'entrada',       tone: 'success', label: 'Entrada'        },
  { type: 'saída',         tone: 'danger',  label: 'Saída'          },
  { type: 'inicio_almoco', tone: 'warn',    label: 'Início almoço'  },
  { type: 'fim_almoco',    tone: 'success', label: 'Fim almoço'     },
  { type: 'pausa_cafe',    tone: 'warn',    label: 'Pausa café'     },
  { type: 'retorno_cafe',  tone: 'success', label: 'Retorno café'   },
]

function ConfirmInner() {
  const params = useSearchParams()
  const emp      = params.get('emp') ?? ''
  const tid      = params.get('tid') ?? ''
  const token    = params.get('t') ?? ''

  const [empName, setEmpName] = useState('')
  const [punching, setPunching] = useState(false)
  const [result, setResult] = useState<{ ok: boolean; msg: string } | null>(null)

  const invalid = !emp || !tid || !token

  const punch = async (type: PunchType) => {
    if (punching || result?.ok) return
    setPunching(true)
    try {
      const res = await fetch('/api/qr/punch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ employeeId: emp, tenantId: tid, token, type }),
      })
      const data = await res.json()
      if (res.ok) {
        if (data.employeeName) setEmpName(data.employeeName)
        const typeLabel = PUNCH_OPTIONS.find(o => o.type === type)?.label ?? type
        setResult({ ok: true, msg: `${data.employeeName ? data.employeeName + ' — ' : ''}${typeLabel} registada com sucesso!` })
      } else {
        setResult({ ok: false, msg: data.error ?? 'Erro ao registar ponto.' })
      }
    } catch { setResult({ ok: false, msg: 'Erro de conexão.' }) }
    finally { setPunching(false) }
  }

  // Apply dark theme automatically (kiosk phones are typically in dark mode)
  useEffect(() => {
    const saved = localStorage.getItem('pg.theme')
    document.documentElement.setAttribute('data-theme', saved ?? 'dark')
  }, [])

  if (invalid) return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--bg)' }}>
      <div style={{ textAlign: 'center', padding: 32, maxWidth: 320 }}>
        <div style={{ fontSize: 40, marginBottom: 16 }}>⚠️</div>
        <div style={{ fontSize: 16, fontWeight: 600, marginBottom: 8 }}>QR Code inválido</div>
        <div style={{ fontSize: 13, color: 'var(--fg-muted)' }}>Este código QR não é válido. Peça ao administrador para gerar um novo.</div>
      </div>
    </div>
  )

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
      <div style={{ maxWidth: 340, width: '100%' }}>
        <div style={{ textAlign: 'center', marginBottom: 28 }}>
          <div style={{ fontSize: 28, marginBottom: 8 }}>🕐</div>
          <div style={{ fontSize: 20, fontWeight: 700, letterSpacing: '-0.02em' }}>
            {empName || 'Registar Ponto'}
          </div>
          <div style={{ fontSize: 13, color: 'var(--fg-muted)', marginTop: 4 }}>Selecione o tipo de registo</div>
        </div>

        {result ? (
          <div style={{
            textAlign: 'center', padding: '24px 20px',
            background: result.ok ? 'rgba(34,197,94,0.1)' : 'rgba(239,68,68,0.1)',
            border: `1px solid ${result.ok ? '#22c55e' : '#ef4444'}`,
            borderRadius: 12,
          }}>
            <div style={{ fontSize: 32, marginBottom: 8 }}>{result.ok ? '✅' : '❌'}</div>
            <div style={{ fontSize: 15, fontWeight: 600, color: result.ok ? '#16a34a' : '#dc2626' }}>{result.msg}</div>
            {result.ok && <div style={{ fontSize: 12, color: 'var(--fg-muted)', marginTop: 8 }}>Pode fechar esta página.</div>}
            {!result.ok && (
              <button onClick={() => setResult(null)} style={{ marginTop: 16, padding: '8px 20px', background: 'var(--surface-2)', border: '1px solid var(--border)', borderRadius: 8, cursor: 'pointer', fontSize: 13 }}>
                Tentar novamente
              </button>
            )}
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            {PUNCH_OPTIONS.map(opt => (
              <button
                key={opt.type}
                onClick={() => punch(opt.type)}
                disabled={punching}
                style={{
                  padding: '18px 12px',
                  background: opt.tone === 'success' ? 'rgba(34,197,94,0.12)' : opt.tone === 'danger' ? 'rgba(239,68,68,0.12)' : 'rgba(234,179,8,0.12)',
                  border: `1px solid ${opt.tone === 'success' ? '#22c55e' : opt.tone === 'danger' ? '#ef4444' : '#eab308'}`,
                  borderRadius: 10, cursor: punching ? 'wait' : 'pointer',
                  fontSize: 14, fontWeight: 600,
                  color: opt.tone === 'success' ? '#16a34a' : opt.tone === 'danger' ? '#dc2626' : '#92400e',
                  textAlign: 'center', transition: 'opacity 0.1s',
                  opacity: punching ? 0.7 : 1,
                }}
              >
                {punching ? '…' : opt.label}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

export default function KioskConfirmPage() {
  return (
    <Suspense fallback={<div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>…</div>}>
      <ConfirmInner />
    </Suspense>
  )
}
