import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { verifyApiAuth } from '@/lib/apiAuth'
import { getEmployees } from '@/lib/data/employees'
import { getTodayRecordsAllEmployees } from '@/lib/data/records'
import { KioskClient } from './KioskClient'

// Auth + data depend on the request cookie, so this page is always dynamic.
export const dynamic = 'force-dynamic'

export default async function KioskPage() {
  const token = cookies().get('ponto_token')?.value
  if (!token) redirect('/login')

  let user
  try {
    user = await verifyApiAuth(token)
  } catch {
    redirect('/login')
  }

  // The kiosk is a shared admin/manager device; employees go to their own screen.
  if (user.role !== 'admin' && user.role !== 'manager') redirect('/ponto')

  const [employees, records] = await Promise.all([
    getEmployees(user),
    getTodayRecordsAllEmployees(user),
  ])

  return <KioskClient initialEmployees={employees} initialRecords={records} />
}
