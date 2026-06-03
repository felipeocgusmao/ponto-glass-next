import { redirect } from 'next/navigation'
import { cookies } from 'next/headers'
import { verifyJWT } from '@/lib/auth'
import Link from 'next/link'

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
      <main style={{
        minHeight: '100dvh', background: 'var(--bg)', color: 'var(--fg)',
        fontFamily: 'var(--font-sans, system-ui, sans-serif)',
      display: 'flex', flexDirection: 'column',
    }}>
      {/* Nav */}
      <nav style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '16px 32px', borderBottom: '1px solid var(--border)',
        background: 'var(--surface)',
      }}>
        <div style={{ fontWeight: 700, fontSize: 18, letterSpacing: '-0.3px', color: 'var(--accent)' }}>
          PontoGlass
        </div>
        <Link href="/login" style={{
          padding: '8px 18px', background: 'var(--accent)', color: '#fff',
          borderRadius: 'var(--r-sm)', textDecoration: 'none', fontSize: 14, fontWeight: 600,
        }}>
          Entrar
        </Link>
      </nav>

      {/* Hero */}
      <section style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '64px 24px', textAlign: 'center' }}>
        <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--accent)', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 16 }}>
          Controlo de ponto digital
        </div>
        <h1 style={{ fontSize: 'clamp(2rem, 5vw, 3.5rem)', fontWeight: 800, letterSpacing: '-1px', lineHeight: 1.1, margin: '0 0 20px', maxWidth: 720 }}>
          O tempo registado com{' '}
          <span style={{ color: 'var(--accent)' }}>transparência</span>
        </h1>
        <p style={{ fontSize: 17, color: 'var(--fg-muted)', maxWidth: 560, margin: '0 0 40px', lineHeight: 1.6 }}>
          Sistema de ponto leve, seguro e bonito — sem instalação, sem servidor próprio.
          Um link, uma senha. O admin vê tudo, em tempo real.
        </p>
        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', justifyContent: 'center' }}>
          <Link href="/login" style={{
            padding: '12px 28px', background: 'var(--accent)', color: '#fff',
            borderRadius: 'var(--r-sm)', textDecoration: 'none', fontSize: 15, fontWeight: 600,
          }}>
            Aceder ao sistema →
          </Link>
          <a
            href="https://github.com/felipeocgusmao/ponto-glass-next"
            target="_blank" rel="noopener noreferrer"
            style={{
              padding: '12px 28px', background: 'var(--surface-2)', color: 'var(--fg)',
              borderRadius: 'var(--r-sm)', textDecoration: 'none', fontSize: 15, fontWeight: 600,
              border: '1px solid var(--border)',
            }}
          >
            Ver código
          </a>
        </div>
      </section>

      {/* Feature grid */}
      <section style={{ padding: '48px 24px 64px', maxWidth: 960, margin: '0 auto', width: '100%' }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 16 }}>
          {[
            { icon: '⏱', title: 'Tempo real', desc: 'Horas trabalhadas, ganhos e estado de cada funcionário em tempo real.' },
            { icon: '📊', title: 'Relatórios', desc: 'CSV e PDF profissionais por período. Horas extras, banco de horas, ganhos em €.' },
            { icon: '🔒', title: 'Segurança', desc: 'JWT httpOnly, bcrypt, rate limit, RLS Supabase, RBAC por role.' },
            { icon: '📱', title: 'PWA', desc: 'Funciona no celular como app. Push notifications nativas via VAPID.' },
            { icon: '🌍', title: 'i18n', desc: 'PT-PT, PT-BR, EN e ES. Fuso horário configurável por empresa.' },
            { icon: '⚙️', title: 'Admin completo', desc: 'Command Palette ⌘K, geofencing, modo quiosque, audit log e muito mais.' },
          ].map(f => (
            <div key={f.title} style={{
              padding: '20px 22px', background: 'var(--surface)', border: '1px solid var(--border)',
              borderRadius: 'var(--r)', display: 'flex', flexDirection: 'column', gap: 8,
            }}>
              <div style={{ fontSize: 24 }}>{f.icon}</div>
              <div style={{ fontWeight: 600, fontSize: 15 }}>{f.title}</div>
              <div style={{ fontSize: 13, color: 'var(--fg-muted)', lineHeight: 1.5 }}>{f.desc}</div>
            </div>
          ))}
        </div>
      </section>

      {/* Stack */}
      <section style={{ borderTop: '1px solid var(--border)', padding: '32px 24px', background: 'var(--surface)' }}>
        <div style={{ maxWidth: 960, margin: '0 auto', display: 'flex', flexWrap: 'wrap', gap: 8, justifyContent: 'center' }}>
          {['Next.js 14', 'TypeScript', 'Supabase', 'PostgreSQL', 'JWT', 'PWA', 'Vitest', 'Sentry', 'Vercel'].map(t => (
            <span key={t} style={{
              padding: '4px 12px', background: 'var(--surface-2)', border: '1px solid var(--border)',
              borderRadius: 20, fontSize: 12, color: 'var(--fg-muted)', fontWeight: 500,
            }}>{t}</span>
          ))}
        </div>
        <div style={{ textAlign: 'center', marginTop: 20, fontSize: 12, color: 'var(--fg-subtle)' }}>
          MIT License · Feito com CSS variables e ♥
        </div>
      </section>
    </main>
    </>
  )
}
