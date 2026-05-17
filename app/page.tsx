import { redirect } from 'next/navigation'
import { cookies } from 'next/headers'
import { verifyJWT } from '@/lib/auth'

export default async function HomePage() {
  const cookieStore = cookies()
  const token = cookieStore.get('ponto_token')?.value

  if (!token) redirect('/login')

  try {
    const user = await verifyJWT(token)
    redirect(user.role === 'admin' ? '/admin' : '/ponto')
  } catch {
    redirect('/login')
  }
}
