'use client'

import { useEffect } from 'react'
import type { EmployeeProfile, PunchRecord } from '@/lib/types'
import { getWorkState, calcLiveMin, businessDate } from '@/lib/utils'

type TFn = (key: string) => string

interface Options {
  user: EmployeeProfile | null
  records: PunchRecord[]
  t: TFn
}

export function usePushNotifications({ user, records, t }: Options) {
  // Register for push notifications (Capacitor native or web Service Worker)
  useEffect(() => {
    const vapidKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY
    if (!vapidKey) return
    ;(async () => {
      try {
        if (typeof window !== 'undefined' && 'serviceWorker' in navigator)
          await navigator.serviceWorker.register('/sw.js').catch(() => {})
        const { registerPush } = await import('@/lib/native')
        const result = await registerPush(vapidKey)
        if (!result) return
        await fetch('/api/push-subscribe', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(result),
        })
      } catch { /* push not critical */ }
    })()
  }, [])

  // 15-min shift-end warning + overtime alert
  useEffect(() => {
    if (typeof window === 'undefined' || typeof Notification === 'undefined') return

    const notify = (title: string, body: string, tag: string) => {
      navigator.serviceWorker.ready
        .then(reg => reg.showNotification(title, { body, icon: '/icon-192.svg', badge: '/icon-192.svg', tag }))
        .catch(() => {})
    }

    const check = () => {
      if (!user || !records.length) return
      if (Notification.permission !== 'granted') return
      const myRecs = records.filter(r => r.employee_id === user.id)
      const { state } = getWorkState(myRecs)
      if (state !== 'working') return
      const liveMin = calcLiveMin(myRecs, user.lunch_break_minutes)
      const targetMin = user.workday_hours * 60
      const remaining = targetMin - liveMin
      const overtime = liveMin - targetMin
      const today = businessDate()
      if (remaining > 0 && remaining <= 15 && !localStorage.getItem(`pg.notif.warn15.${today}.${user.id}`)) {
        localStorage.setItem(`pg.notif.warn15.${today}.${user.id}`, '1')
        notify('Hora de terminar em breve ⏱', `Faltam ${Math.round(remaining)} min para completar a tua jornada.`, 'end-warning')
      }
      if (overtime >= 1 && !localStorage.getItem(`pg.notif.overtime.${today}.${user.id}`)) {
        localStorage.setItem(`pg.notif.overtime.${today}.${user.id}`, '1')
        notify('Jornada concluída 🔔', 'Já completaste a jornada de hoje. Não te esqueças de registar a saída!', 'overtime-alert')
      }
    }

    check()
    const iv = setInterval(check, 60_000)
    return () => clearInterval(iv)
  }, [user, records])

  // Quarter-hour reminder: fires 1-2 min before :00/:15/:30/:45
  useEffect(() => {
    if (typeof window === 'undefined' || typeof Notification === 'undefined') return

    const parseHM = (s: string | null | undefined): number | null => {
      if (!s) return null
      const [h, m] = s.split(':').map(Number)
      if (isNaN(h) || isNaN(m)) return null
      return h * 60 + m
    }

    const notify = (title: string, body: string, tag: string) => {
      navigator.serviceWorker.ready
        .then(reg => reg.showNotification(title, { body, icon: '/icon-192.svg', badge: '/icon-192.svg', tag }))
        .catch(() => {})
    }

    const check = () => {
      if (!user) return
      if (Notification.permission !== 'granted') return
      const now = new Date()
      const myRecs = records.filter(r => r.employee_id === user.id)
      const { state } = getWorkState(myRecs)
      if (state !== 'working' && state !== 'absent') return
      const nowMin = now.getHours() * 60 + now.getMinutes()
      const minsUntilQuarter = (15 - (nowMin % 15)) % 15
      if (minsUntilQuarter > 2 || minsUntilQuarter === 0) return
      const targetMin = nowMin + minsUntilQuarter
      const hh = String(Math.floor(targetMin / 60) % 24).padStart(2, '0')
      const mm = String(targetMin % 60).padStart(2, '0')
      const targetLabel = `${hh}:${mm}`
      const today = businessDate()
      if (state === 'absent') {
        const startMin = parseHM(user.expected_start) ?? 8 * 60
        if (nowMin < startMin) return
        const key = `pg.notif.q.entry.${today}.${targetLabel}`
        if (localStorage.getItem(key)) return
        localStorage.setItem(key, '1')
        notify(t('ponto.notif.entry.title'), t('ponto.notif.entry.body').replace('{time}', targetLabel), `quarter-entry-${targetLabel}`)
        return
      }
      const liveMin = calcLiveMin(myRecs, user.lunch_break_minutes)
      const endMin = parseHM(user.expected_end)
      const workdayMin = user.workday_hours * 60
      const eligible = endMin != null ? nowMin >= endMin : liveMin >= workdayMin
      if (!eligible) return
      const key = `pg.notif.q.exit.${today}.${targetLabel}`
      if (localStorage.getItem(key)) return
      localStorage.setItem(key, '1')
      notify(t('ponto.notif.exit.title'), t('ponto.notif.exit.body').replace('{time}', targetLabel), `quarter-exit-${targetLabel}`)
    }

    const iv = setInterval(check, 60_000)
    return () => clearInterval(iv)
  }, [user, records, t])
}
