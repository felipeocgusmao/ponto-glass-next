import { redirect } from 'next/navigation'
import { cookies } from 'next/headers'
import { verifyJWT } from '@/lib/auth'

// Instância privada: a raiz não expõe vitrine pública nem metadados de SEO.
// Visitantes autenticados vão direto ao seu painel; qualquer outro acesso é
// encaminhado ao login. (redirect() fica fora do try/catch para não ser
// engolido pelo NEXT_REDIRECT.)
export default async function HomePage() {
  const token = cookies().get('ponto_token')?.value

  let target = '/login'
  if (token) {
    try {
      const user = await verifyJWT(token)
      target = ['admin', 'manager'].includes(user.role) ? '/admin' : '/ponto'
    } catch {
      /* token expirado/inválido — segue para o login */
    }
  }

  redirect(target)
}
