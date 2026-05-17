import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { verifyJWT } from '@/lib/auth'

export async function GET() {
  const token = cookies().get('ponto_token')?.value
  if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const user = await verifyJWT(token)
    return NextResponse.json(user)
  } catch {
    return NextResponse.json({ error: 'Invalid token' }, { status: 401 })
  }
}
