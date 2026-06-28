import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { verifyApiAuth } from '@/lib/apiAuth'
import { getEmployeeProfile } from '@/lib/data/profile'
import { getEmployees } from '@/lib/data/employees'
import { getPendingCorrectionsCount } from '@/lib/data/corrections'
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
    redirect('/login')
  }

  // Only admin/manager belong here (mirrors the middleware redirect).
  if (user.role !== 'admin' && user.role !== 'manager') redirect('/ponto')

  const [profile, employees, pendingCorrections] = await Promise.all([
    getEmployeeProfile(user),
    getEmployees(user, { includeInactive: true }),
    getPendingCorrectionsCount(user),
  ])
  if (!profile) redirect('/login')

  return (
    <AdminClient
      initialUser={profile}
      initialEmployees={employees}
      initialPendingCorrections={pendingCorrections}
    />
  )
}
