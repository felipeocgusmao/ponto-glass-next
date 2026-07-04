import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { verifyApiAuth } from '@/lib/apiAuth'
import { getEmployeeProfile } from '@/lib/data/profile'
import { getEmployees } from '@/lib/data/employees'
import { getPendingCorrectionsCount } from '@/lib/data/corrections'
import { getRecordsRange, getTodayRecordsAllEmployees } from '@/lib/data/records'
import { getDayExceptions } from '@/lib/data/dayExceptions'
import { businessDate } from '@/lib/utils'
import { AdminClient } from './AdminClient'

// Auth + data depend on the request cookie, so this page is always dynamic.
export const dynamic = 'force-dynamic'

export default async function AdminPage() {
  const token = cookies().get('ponto_token')?.value
  if (!token) redirect('/login')

  let user
  try {
    user = await verifyApiAuth(token)
  } catch {
    // Signature ok but session revoked/inactive/unknown → tell /login to clear the
    // stale cookie instead of redirecting back here (avoids an infinite loop).
    redirect('/login?session=expired')
  }

  // Only admin/manager belong here (mirrors the middleware redirect).
  if (user.role !== 'admin' && user.role !== 'manager') redirect('/ponto')

  // Admins land on the Dashboard tab — seed its data here so the first paint
  // carries real content instead of a skeleton waiting on a client fetch wave
  // (each of those API calls would also re-run verifyApiAuth). Managers land on
  // "Meu Ponto" and platform-only super-admins on "Empresas"; opening the
  // dashboard later fetches fresh data client-side as before.
  // The window mirrors what DashboardTab derives from `seedNow` (see DashboardSeed).
  const seedDashboard = user.role === 'admin'
  const seedNow = Date.now()
  const todayStr = businessDate(new Date(seedNow))
  const chartFromStr = new Date(seedNow - 30 * 86400000).toISOString().split('T')[0]
  const next30Str = new Date(seedNow + 30 * 86400000).toISOString().split('T')[0]

  const [profile, employees, pendingCorrections, monthRecs, todayRecs, exceptions] = await Promise.all([
    getEmployeeProfile(user),
    getEmployees(user, { includeInactive: true }),
    getPendingCorrectionsCount(user),
    seedDashboard ? getRecordsRange(user, chartFromStr, todayStr) : null,
    seedDashboard ? getTodayRecordsAllEmployees(user) : null,
    seedDashboard ? getDayExceptions(user, { from: todayStr, to: next30Str }) : null,
  ])
  if (!profile) redirect('/login?session=expired')

  return (
    <AdminClient
      initialUser={profile}
      initialEmployees={employees}
      initialPendingCorrections={pendingCorrections}
      initialDashboard={
        monthRecs && todayRecs && exceptions
          ? { monthRecs, todayRecs, exceptions, now: seedNow }
          : null
      }
    />
  )
}
