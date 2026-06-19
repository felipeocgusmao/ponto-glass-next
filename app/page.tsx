import { redirect } from 'next/navigation'
import { cookies } from 'next/headers'
import { verifyJWT } from '@/lib/auth'
import LandingPage from './_components/LandingPage'

const jsonLd = {
  '@context': 'https://schema.org',
  '@type': 'SoftwareApplication',
  name: 'PontoGlass',
  applicationCategory: 'BusinessApplication',
  operatingSystem: 'Web, PWA, Android, iOS',
  url: 'https://ponto-glass-next.vercel.app',
  description:
    'Sistema de controlo de ponto digital — leve, seguro e bonito. JWT, PWA, push notifications, geofencing, multi-idioma. Open source.',
  author: {
    '@type': 'Person',
    name: 'Felipe Gusmão',
    url: 'https://github.com/felipeocgusmao',
  },
  license: 'https://opensource.org/licenses/MIT',
  softwareVersion: '0.3.0',
  offers: { '@type': 'Offer', price: '0', priceCurrency: 'EUR' },
  featureList: [
    'Registo de ponto em tempo real',
    'Relatórios CSV e PDF',
    'Geofencing por funcionário',
    'Notificações push (VAPID)',
    'Exportação de holerite',
    'Banco de horas',
    'Multi-idioma (PT, EN, ES)',
    'Progressive Web App',
  ],
}

export default async function HomePage() {
  const cookieStore = cookies()
  const token = cookieStore.get('ponto_token')?.value

  if (token) {
    try {
      const user = await verifyJWT(token)
      redirect(['admin', 'manager'].includes(user.role) ? '/admin' : '/ponto')
    } catch { /* expired/invalid token — show landing */ }
  }

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <LandingPage />
    </>
  )
}
