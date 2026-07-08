'use client'

import { useState, useEffect } from 'react'
import type { Tab } from '../_lib/types'

const STORAGE_KEY = 'pg.onboarding-dismissed'

interface OnboardingBannerProps {
  employeeCount: number
  onNavigate: (tab: Tab) => void
}

// Shown to admins who just set up their account and have no team yet.
// Dismissed permanently via localStorage.
export default function OnboardingBanner({ employeeCount, onNavigate }: OnboardingBannerProps) {
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    if (localStorage.getItem(STORAGE_KEY)) return
    // Show if the admin is alone (no other employees created yet)
    if (employeeCount <= 1) setVisible(true)
  }, [employeeCount])

  const dismiss = () => {
    localStorage.setItem(STORAGE_KEY, '1')
    setVisible(false)
  }

  if (!visible) return null

  const steps = [
    {
      done: true,
      label: 'Conta criada',
      desc: 'Estás dentro do sistema.',
      action: null,
    },
    {
      done: employeeCount > 1,
      label: 'Configurar jornada da equipa',
      desc: 'Define horas/dia e pausa de almoço ao adicionar funcionários (ou em modelos de turno).',
      action: () => onNavigate('funcionarios'),
      actionLabel: 'Ir para Equipe',
    },
    {
      done: employeeCount > 1,
      label: 'Criar primeiro funcionário',
      desc: 'Adiciona a tua equipa para começar a registar pontos.',
      action: () => onNavigate('funcionarios'),
      actionLabel: 'Ir para Funcionários',
    },
    {
      done: false,
      label: 'Bater o primeiro ponto',
      desc: 'Testa o registo de entrada em Meu Ponto.',
      action: () => onNavigate('meu_ponto'),
      actionLabel: 'Ir para Meu Ponto',
    },
  ]

  const doneCount = steps.filter(s => s.done).length

  return (
    <div className="card" style={{
      marginBottom: 20,
      border: '1px solid color-mix(in srgb, var(--accent) 30%, transparent)',
      background: 'color-mix(in srgb, var(--accent) 5%, transparent)',
    }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, marginBottom: 16 }}>
        <div>
          <div style={{ fontWeight: 700, fontSize: 15 }}>🎉 Bem-vindo ao PontoGlass</div>
          <div style={{ fontSize: 12, color: 'var(--fg-muted)', marginTop: 2 }}>
            {doneCount}/{steps.length} passos concluídos
          </div>
        </div>
        <button
          onClick={dismiss}
          style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--fg-muted)', fontSize: 18, lineHeight: 1, padding: 0 }}
          title="Fechar"
        >×</button>
      </div>

      {/* Progress bar */}
      <div style={{ height: 4, background: 'var(--border)', borderRadius: 2, marginBottom: 16, overflow: 'hidden' }}>
        <div style={{
          height: '100%',
          width: `${(doneCount / steps.length) * 100}%`,
          background: 'var(--accent)',
          borderRadius: 2,
          transition: 'width 0.4s ease',
        }} />
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {steps.map((step, i) => (
          <div key={i} style={{
            display: 'flex',
            alignItems: 'center',
            gap: 12,
            padding: '10px 12px',
            background: step.done
              ? 'color-mix(in srgb, var(--accent) 6%, transparent)'
              : 'var(--surface-2)',
            borderRadius: 'var(--r-sm, 6px)',
            border: '1px solid var(--border)',
            opacity: step.done ? 0.7 : 1,
          }}>
            <div style={{
              width: 22, height: 22, borderRadius: '50%', flexShrink: 0,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              background: step.done ? 'var(--accent)' : 'var(--border)',
              color: step.done ? '#fff' : 'var(--fg-muted)',
              fontSize: 12, fontWeight: 700,
            }}>
              {step.done ? '✓' : i + 1}
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 13, fontWeight: step.done ? 400 : 600, textDecoration: step.done ? 'line-through' : 'none', color: step.done ? 'var(--fg-muted)' : 'var(--fg)' }}>
                {step.label}
              </div>
              {!step.done && (
                <div style={{ fontSize: 11, color: 'var(--fg-muted)', marginTop: 1 }}>{step.desc}</div>
              )}
            </div>
            {!step.done && step.action && (
              <button className="btn ghost sm" onClick={step.action} style={{ whiteSpace: 'nowrap', flexShrink: 0 }}>
                {step.actionLabel}
              </button>
            )}
          </div>
        ))}
      </div>

      <div style={{ marginTop: 14, fontSize: 11, color: 'var(--fg-muted)', textAlign: 'right' }}>
        <button onClick={dismiss} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--fg-muted)', textDecoration: 'underline', fontSize: 11 }}>
          Não mostrar novamente
        </button>
      </div>
    </div>
  )
}
