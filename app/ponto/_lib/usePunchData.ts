'use client'

import { useCallback, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import type { EmployeeProfile, PunchRecord } from '@/lib/types'

interface UsePunchDataOptions {
  onUserTheme?: (theme: 'dark' | 'light') => void
}

export function usePunchData({ onUserTheme }: UsePunchDataOptions = {}) {
  const [user, setUser] = useState<EmployeeProfile | null>(null)
  const [records, setRecords] = useState<PunchRecord[]>([])
  const [fetchError, setFetchError] = useState(false)
  const fetchSeq = useRef(0)
  const router = useRouter()
  const onUserThemeRef = useRef(onUserTheme)
  onUserThemeRef.current = onUserTheme

  const endDeadSession = useCallback(async () => {
    try { await fetch('/api/auth/logout', { method: 'POST' }) } catch { /* clear cookie anyway */ }
    router.replace('/login')
  }, [router])

  const loadUser = useCallback(async () => {
    setFetchError(false)
    try {
      const res = await fetch('/api/me')
      if (!res.ok) { await endDeadSession(); return }
      const profile = await res.json()
      setUser(profile)
      if (profile.theme) onUserThemeRef.current?.(profile.theme)
    } catch { setFetchError(true) }
  }, [endDeadSession])

  const loadRecords = useCallback(async () => {
    const seq = ++fetchSeq.current
    try {
      const res = await fetch('/api/records?today=true')
      if (!res.ok) return
      const data = await res.json()
      if (seq === fetchSeq.current) setRecords(data)
    } catch { /* keep */ }
  }, [])

  return { user, setUser, records, setRecords, fetchError, setFetchError, loadUser, loadRecords }
}
