import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { verifyApiAuth } from '@/lib/apiAuth'
import { getEmployeeProfile } from '@/lib/data/profile'
import { getTodayRecordsForEmployee } from '@/lib/data/records'
import { PontoClient } from './PontoClient'

// Auth + data depend on the request cookie, so this page is always dynamic.
export const dynamic = 'force-dynamic'

export default async function PontoPage() {
  // The middleware already gates this route, but we re-verify here because the
  // Server Component reads the DB-backed identity (tenant_id) needed to scope
  // the queries — and to fail closed if the token is somehow invalid.
  const token = cookies().get('ponto_token')?.value
  if (!token) redirect('/login')

  let user
  try {
    user = await verifyApiAuth(token)
  } catch {
    redirect('/login')
  }

  // Privileged users live in /admin (mirrors the middleware redirect).
  if (user.role === 'admin' || user.role === 'manager') redirect('/admin')

  const [profile, records] = await Promise.all([
    getEmployeeProfile(user),
    getTodayRecordsForEmployee(user, user.id),
  ])
  if (!profile) redirect('/login')

  return <PontoClient initialUser={profile} initialRecords={records} />
}
