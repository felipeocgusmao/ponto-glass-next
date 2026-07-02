import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { verifyApiAuth } from '@/lib/apiAuth'
import { supabase } from '@/lib/supabase'
import { getEmployees } from '@/lib/data/employees'
import { getTodayRecordsAllEmployees } from '@/lib/data/records'
import { KioskClient } from './KioskClient'
import { TokenKioskClient } from './TokenKioskClient'

// Auth + data depend on the request cookie, so this page is always dynamic.
export const dynamic = 'force-dynamic'

export default async function KioskPage({
  searchParams,
}: {
  searchParams: { token?: string }
}) {
  // Shared-tablet mode: /kiosk?token=<kiosk_token> (the link Integrações
  // generates) works WITHOUT a session — the kiosk token is the credential.
  // Validate it server-side so an invalid/revoked token never renders the UI.
  const kioskToken = searchParams.token
  if (kioskToken) {
    const { data: tenant } = await supabase
      .from('tenants')
      .select('id')
      .eq('kiosk_token', kioskToken)
      .eq('active', true)
      .maybeSingle()
    if (!tenant) redirect('/login')
    return <TokenKioskClient token={kioskToken} />
  }

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

  // The kiosk is a shared admin/manager device; employees go to their own screen.
  if (user.role !== 'admin' && user.role !== 'manager') redirect('/ponto')

  const [employees, records] = await Promise.all([
    getEmployees(user),
    getTodayRecordsAllEmployees(user),
  ])

  return <KioskClient initialEmployees={employees} initialRecords={records} />
}
