'use client'

import { useCallback, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import LiveClock from '@/components/LiveClock'
import ChangePasswordModal from '@/components/ChangePasswordModal'
import { calcHours, avatarInitials, calcOvertimeToday, fmtMinutes } from '@/lib/utils'
import type { JWTUser, PunchRecord } from '@/lib/types'

export default function PontoPage() {
  const [user, setUser] = useState<JWTUser | null>(null)
  const [records, setRecords] = useState<PunchRecord[]>([])
  const [loading, setLoading] = useState(false)
  const [msg, setMsg] = useState<{ kind: 'success' | 'error'; text: string } | null>(null)
  const [showPwd, setShowPwd] = useState(false)
  const router = useRouter()

  const fetchData = useCallback(async () => {
    const [userRes, recRes] = await Promise.all([
      fetch('/api/me'),
      fetch('/api/records?today=true'),
    ])
    if (!userRes.ok) { router.push('/login'); return }
    setUser(await userRes.json())
    if (recRes.ok) setRecords(await recRes.json())
  }, [router])

  useEffect(() => { fetchData() }, [fetchData])

  const handlePunch = async (type: 'entrada' | 'saída') => {
    setLoading(true)
    setMsg(null)
    const res = await fetch('/api/punch', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type }),
    })
    setMsg(res.ok
      ? { kind: 'success', text: type === 'entrada' ? '✅ Entrada registrada!' : '✅ Saída registrada!' }
      : { kind: 'error', text: 'Erro ao registrar ponto.' }
    )
    if (res.ok) await fetchData()
    setLoading(false)
    setTimeout(() => setMsg(null), 3000)
  }

  const handleLogout = async () => {
    await fetch('/api/auth/logout', { method: 'POST' })
    router.push('/login')
  }

  if (!user) return (
    <main className="min-h-screen flex items-center justify-center">
      <div className="clock-time opacity-30">...</div>
    </main>
  )

  const sorted = [...records].sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
  const isInside = sorted[0]?.type === 'entrada'
  const initials = avatarInitials(user.name)
  const overtime = calcOvertimeToday(records)

  return (
    <main className="min-h-screen p-4 md:p-8">
      {showPwd && <ChangePasswordModal onClose={() => setShowPwd(false)} />}

      <div className="max-w-md mx-auto">

        {/* Top bar */}
        <div className="flex items-center justify-between mb-5">
          <div className="flex items-center gap-3">
            <div className="avatar">{initials}</div>
            <div>
              <div className="font-semibold text-sm text-white">{user.name}</div>
              <div className="text-white/40 text-xs">@{user.username}</div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={() => setShowPwd(true)} className="btn-settings" title="Trocar senha">⚙</button>
            <button onClick={handleLogout} className="btn-logout">Sair</button>
          </div>
        </div>

        {/* Punch card */}
        <div className="glass p-8 mb-4">
          <LiveClock />

          <div className="text-center mb-5">
            <span className={isInside ? 'status-in' : 'status-out'}>
              {isInside ? '● Você está dentro' : '● Você está fora'}
            </span>
          </div>

          {msg && <div className={`mb-4 ${msg.kind === 'success' ? 'alert-success' : 'alert-error'}`}>{msg.text}</div>}

          <button
            onClick={() => handlePunch(isInside ? 'saída' : 'entrada')}
            disabled={loading}
            className={`w-full ${isInside ? 'btn-saida' : 'btn-entrada'}`}
          >
            {loading ? '...' : isInside ? '⏹  Registrar Saída' : '▶  Registrar Entrada'}
          </button>
        </div>

        {/* Today's records */}
        {records.length > 0 && (
          <div className="glass p-6">
            <div className={`grid gap-3 mb-5 ${overtime !== null ? 'grid-cols-3' : 'grid-cols-2'}`}>
              <div className="metric-box">
                <div className="metric-val">{calcHours(records)}</div>
                <div className="metric-lbl">Horas hoje</div>
              </div>
              <div className="metric-box">
                <div className="metric-val">{records.length}</div>
                <div className="metric-lbl">Registros hoje</div>
              </div>
              {overtime !== null && (
                <div className="metric-box">
                  <div className={`metric-val text-2xl ${overtime >= 0 ? 'text-yellow-300' : 'text-red-400'}`}>
                    {overtime >= 0 ? '+' : '-'}{fmtMinutes(overtime)}
                  </div>
                  <div className="metric-lbl">{overtime >= 0 ? 'Hora extra' : 'A cumprir'}</div>
                </div>
              )}
            </div>

            <span className="section-label">Registros de hoje</span>
            {sorted.map((r) => (
              <div key={r.id} className="record-item">
                <span className="font-semibold text-white">
                  {new Date(r.timestamp).toLocaleTimeString('pt-BR')}
                </span>
                <span className={r.type === 'entrada' ? 'rec-tag-in' : 'rec-tag-out'}>
                  {r.type === 'entrada' ? 'Entrada' : 'Saída'}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </main>
  )
}
