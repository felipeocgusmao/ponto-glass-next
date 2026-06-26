'use client'

import { useEffect, useState } from 'react'
import type { EmployeeProfile, PunchRecord } from '@/lib/types'
import { getWorkState, haversineMeters } from '@/lib/utils'

interface Options {
  user: EmployeeProfile | null
  records: PunchRecord[]
  loadRecords: () => Promise<void>
  onAutoExit: (msg: string) => void
}

async function getGeo(): Promise<{ lat: number; lng: number } | null> {
  const { getPosition } = await import('@/lib/native')
  return getPosition(8000)
}

export function useGeofence({ user, records, loadRecords, onAutoExit }: Options) {
  const [geoDistance, setGeoDistance] = useState<number | null>(null)

  // Real-time distance indicator shown in PontoTab
  useEffect(() => {
    if (!user || !user.workplace_lat || user.geo_mode === 'disabled') return

    const update = async () => {
      if (document.visibilityState !== 'visible') return
      const geo = await getGeo()
      if (!geo) return
      setGeoDistance(Math.round(haversineMeters(user.workplace_lat!, user.workplace_lng!, geo.lat, geo.lng)))
    }

    update()
    const iv = setInterval(update, 30_000)
    return () => clearInterval(iv)
  }, [user])

  // Auto punch-out when employee leaves the workplace radius
  useEffect(() => {
    if (!user) return
    const myRecs = records.filter(r => r.employee_id === user.id)
    const { state } = getWorkState(myRecs)
    if (state !== 'working') return
    if (user.geo_mode !== 'required') return
    if (user.workplace_lat == null) return

    const iv = setInterval(async () => {
      if (document.visibilityState !== 'visible') return
      const geo = await getGeo()
      if (!geo) return
      const distM = haversineMeters(user.workplace_lat!, user.workplace_lng!, geo.lat, geo.lng)
      const maxDist = (user.max_distance_meters ?? 200) * 1.5
      if (distM > maxDist) {
        try {
          const res = await fetch('/api/punch', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ type: 'saída', auto_exit: true, latitude: geo.lat, longitude: geo.lng }),
          })
          if (res.ok) {
            onAutoExit('Saída automática registada por geolocalização.')
            loadRecords()
          }
        } catch { /* non-critical */ }
      }
    }, 300_000)
    return () => clearInterval(iv)
  }, [user, records, loadRecords, onAutoExit])

  return { geoDistance }
}
