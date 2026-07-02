import type { Metadata } from 'next'
import Link from 'next/link'
import { CopyButton } from './CopyButton'

export const metadata: Metadata = {
  title: 'Demo — PontoGlass',
  description: 'Acesse o sistema de demonstração com credenciais públicas. Dados fictícios — nenhuma informação real.',
  robots: { index: false },
}

const CREDENTIALS = [
  {
    role: 'Admin',
    color: '#6366f1',
    badge: 'Admin',
    // 'admin' (sem sufixo) é a conta real do dono da instância — a credencial
    // pública de avaliação vive numa conta própria, no tenant isolado 'demo',
    // semeada por supabase/seed-demo-tenant.sql.
    username: 'admin_demo',
    password: 'demo1234',
    description: 'Acesso completo — dashboard, relatórios, gestão de funcionários, auditoria.',
  },
  {
    role: 'Gerente',
    color: '#0891b2',
    badge: 'Gerente',
    username: 'gerente_demo',
    password: 'demo1234',
    description: 'Visão operacional — monitorização ao vivo, aprovação de correções, banco de horas.',
  },
  {
    role: 'Funcionário',
    color: '#059669',
    badge: 'Funcionário',
    username: 'funcionario_demo',
    password: 'demo1234',
    description: 'Vista do trabalhador — bater ponto, histórico, correções, holerite.',
  },
]

export default function DemoPage() {
  return (
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
        <Link href="/" style={{ fontWeight: 700, fontSize: 18, letterSpacing: '-0.3px', color: 'var(--accent)', textDecoration: 'none' }}>
          PontoGlass
        </Link>
        <Link href="/login" style={{
          padding: '8px 18px', background: 'var(--accent)', color: '#fff',
          borderRadius: 'var(--r-sm)', textDecoration: 'none', fontSize: 14, fontWeight: 600,
        }}>
          Login próprio
        </Link>
      </nav>

      <div style={{ flex: 1, maxWidth: 720, margin: '0 auto', width: '100%', padding: '48px 24px' }}>
        {/* Header */}
        <div style={{ marginBottom: 40 }}>
          <div style={{
            display: 'inline-block', padding: '4px 12px', borderRadius: 20,
            background: 'rgba(99,102,241,0.12)', border: '1px solid rgba(99,102,241,0.25)',
            color: 'var(--accent)', fontSize: 12, fontWeight: 600,
            letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 16,
          }}>
            Demonstração
          </div>
          <h1 style={{ fontSize: 'clamp(1.6rem, 4vw, 2.4rem)', fontWeight: 800, letterSpacing: '-0.5px', margin: '0 0 12px' }}>
            Experimente o PontoGlass
          </h1>
          <p style={{ fontSize: 16, color: 'var(--fg-muted)', lineHeight: 1.6, margin: 0 }}>
            Use as credenciais abaixo para explorar cada perfil de acesso.
            Os dados são fictícios e reiniciados periodicamente.
          </p>
        </div>

        {/* Warning banner */}
        <div style={{
          padding: '14px 18px', borderRadius: 'var(--r)',
          background: 'rgba(234,179,8,0.08)', border: '1px solid rgba(234,179,8,0.25)',
          color: 'var(--warning-fg, #b45309)', fontSize: 13, marginBottom: 32,
          display: 'flex', gap: 10, alignItems: 'flex-start',
        }}>
          <span style={{ fontSize: 16, flexShrink: 0 }}>⚠️</span>
          <span>
            Estes são dados fictícios para fins de demonstração. Não insira informações pessoais reais
            neste ambiente. As ações realizadas (batidas, correções, etc.) podem ser visíveis por outros visitantes.
          </span>
        </div>

        {/* Credential cards */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16, marginBottom: 40 }}>
          {CREDENTIALS.map((cred) => (
            <div key={cred.role} style={{
              padding: '24px', background: 'var(--surface)',
              border: '1px solid var(--border)', borderRadius: 'var(--r)',
              display: 'flex', flexDirection: 'column', gap: 16,
            }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <span style={{
                    padding: '3px 10px', borderRadius: 20, fontSize: 12, fontWeight: 600,
                    background: `${cred.color}22`, color: cred.color,
                    border: `1px solid ${cred.color}44`,
                  }}>
                    {cred.badge}
                  </span>
                  <span style={{ fontSize: 14, color: 'var(--fg-muted)' }}>{cred.description}</span>
                </div>
                {/* Sempre via /login?tenant=demo: as contas demo vivem no tenant
                    'demo', que o host sozinho não resolve. */}
                <Link href="/login?tenant=demo" style={{
                  padding: '8px 18px', background: 'var(--accent)', color: '#fff',
                  borderRadius: 'var(--r-sm)', textDecoration: 'none', fontSize: 13, fontWeight: 600,
                  whiteSpace: 'nowrap',
                }}>
                  Acessar →
                </Link>
              </div>

              <div style={{
                display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12,
              }}>
                <div style={{
                  padding: '12px 14px', background: 'var(--surface-2)',
                  border: '1px solid var(--border)', borderRadius: 'var(--r-sm)',
                }}>
                  <div style={{ fontSize: 11, color: 'var(--fg-subtle)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 4 }}>
                    Usuário
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <code style={{ fontSize: 14, fontWeight: 600, letterSpacing: '0.02em' }}>{cred.username}</code>
                    <CopyButton value={cred.username} />
                  </div>
                </div>
                <div style={{
                  padding: '12px 14px', background: 'var(--surface-2)',
                  border: '1px solid var(--border)', borderRadius: 'var(--r-sm)',
                }}>
                  <div style={{ fontSize: 11, color: 'var(--fg-subtle)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 4 }}>
                    Senha
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <code style={{ fontSize: 14, fontWeight: 600, letterSpacing: '0.02em' }}>{cred.password}</code>
                    <CopyButton value={cred.password} />
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Footer links */}
        <div style={{
          paddingTop: 24, borderTop: '1px solid var(--border)',
          display: 'flex', gap: 16, flexWrap: 'wrap', justifyContent: 'center',
        }}>
          <Link href="/" style={{ color: 'var(--fg-muted)', textDecoration: 'none', fontSize: 14 }}>
            ← Página inicial
          </Link>
          <a
            href="https://github.com/felipeocgusmao/ponto-glass-next"
            target="_blank" rel="noopener noreferrer"
            style={{ color: 'var(--fg-muted)', textDecoration: 'none', fontSize: 14 }}
          >
            Ver código-fonte
          </a>
        </div>
      </div>
    </main>
  )
}
