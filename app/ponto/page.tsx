'use client'

import { useCallback, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import PunchCard from '@/components/PunchCard'
import ChangePasswordModal from '@/components/ChangePasswordModal'
import { avatarInitials } from '@/lib/utils'
import type { EmployeeProfile } from '@/lib/types'

export default function PontoPage() {
  const [user, setUser] = useState<EmployeeProfile | null>(null)
  const [showPwd, setShowPwd] = useState(false)
  const [fetchError, setFetchError] = useState(false)
  const router = useRouter()

  const fetchUser = useCallback(async () => {
    setFetchError(false)
    try {
      const res = await fetch('/api/me')
      if (!res.ok) { router.push('/login'); return }
      setUser(await res.json())
    } catch {
      setFetchError(true)
    }
  }, [router])

  useEffect(() => { fetchUser() }, [fetchUser])

  const handleLogout = async () => {
    await fetch('/api/auth/logout', { method: 'POST' })
    router.push('/login')
  }

  if (fetchError) return (
    <main className="min-h-screen flex items-center justify-center p-4">
      <div className="glass p-8 text-center max-w-sm w-full">
        <div className="text-white/50 mb-4">Erro ao conectar. Verifique sua conexão.</div>
        <button onClick={fetchUser} className="btn-glass w-full">Tentar novamente</button>
      </div>
    </main>
  )

  if (!user) return (
    <main className="min-h-screen flex items-center justify-center">
      <div className="clock-time opacity-30">...</div>
    </main>
  )

  return (
    <main className="min-h-screen p-4 md:p-8">
      {showPwd && <ChangePasswordModal onClose={() => setShowPwd(false)} />}

      <div className="max-w-md mx-auto space-y-4">

        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="avatar">{avatarInitials(user.name)}</div>
            <div>
              <div className="font-semibold text-sm text-white">{user.name}</div>
              <div className="text-white/35 text-xs mt-0.5">@{user.username}</div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={() => setShowPwd(true)} className="btn-settings" title="Trocar senha">⚙</button>
            <button onClick={handleLogout} className="btn-logout">Sair</button>
          </div>
        </div>

        <PunchCard
          workdayMinutes={Math.round(user.workday_hours * 60)}
          lunchBreakMinutes={user.lunch_break_minutes}
          hourlyRate={user.hourly_rate}
          userId={user.id}
        />
      </div>
    </main>
  )
}
