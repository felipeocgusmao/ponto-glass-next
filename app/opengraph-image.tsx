import { ImageResponse } from 'next/og'

export const runtime = 'edge'
export const alt = 'PontoGlass — o tempo, finalmente, tem forma'
export const size = { width: 1200, height: 630 }
export const contentType = 'image/png'

export default function OgImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          background: 'linear-gradient(135deg, #0a0c14 0%, #0f0f1a 50%, #0a0c14 100%)',
          position: 'relative',
          overflow: 'hidden',
        }}
      >
        {/* Glow blobs */}
        <div style={{
          position: 'absolute', top: -120, left: -80,
          width: 560, height: 560,
          borderRadius: '50%',
          background: 'radial-gradient(circle, rgba(99,102,241,0.22) 0%, transparent 70%)',
          display: 'flex',
        }} />
        <div style={{
          position: 'absolute', bottom: -140, right: -60,
          width: 480, height: 480,
          borderRadius: '50%',
          background: 'radial-gradient(circle, rgba(34,211,238,0.12) 0%, transparent 70%)',
          display: 'flex',
        }} />

        {/* Subtle grid */}
        <div style={{
          position: 'absolute', inset: 0,
          backgroundImage:
            'linear-gradient(rgba(255,255,255,0.025) 1px, transparent 1px),' +
            'linear-gradient(90deg, rgba(255,255,255,0.025) 1px, transparent 1px)',
          backgroundSize: '80px 80px',
          display: 'flex',
        }} />

        {/* Content */}
        <div style={{
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          height: '100%',
          padding: '64px 80px',
          position: 'relative',
        }}>
          {/* Top: logo + domain */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
            {/* Clock icon */}
            <div style={{
              width: 52, height: 52,
              borderRadius: 14,
              background: 'linear-gradient(135deg, #4f46e5, #6366f1)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              boxShadow: '0 0 24px rgba(99,102,241,0.5)',
              fontSize: 28,
            }}>
              ⏱
            </div>
            <span style={{ color: '#6366f1', fontSize: 22, fontWeight: 700, letterSpacing: '-0.3px' }}>
              PontoGlass
            </span>
            <span style={{ color: 'rgba(255,255,255,0.25)', fontSize: 18, marginLeft: 8 }}>·</span>
            <span style={{ color: 'rgba(255,255,255,0.35)', fontSize: 18 }}>
              ponto-glass-next.vercel.app
            </span>
          </div>

          {/* Center: headline */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 20, maxWidth: 880 }}>
            <div style={{
              fontSize: 13, fontWeight: 600, color: '#818cf8',
              letterSpacing: '0.12em', textTransform: 'uppercase',
            }}>
              Controlo de ponto digital
            </div>
            <div style={{
              fontSize: 72, fontWeight: 800, color: '#ffffff',
              lineHeight: 1.05, letterSpacing: '-2px',
            }}>
              O tempo,{' '}
              <span style={{ color: '#818cf8' }}>finalmente</span>
              , tem forma.
            </div>
            <div style={{
              fontSize: 22, color: 'rgba(255,255,255,0.52)', lineHeight: 1.5, maxWidth: 680,
            }}>
              Sistema leve, seguro e open source — sem instalação, sem servidor próprio.
            </div>
          </div>

          {/* Bottom: tech badges */}
          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
            {['Next.js 14', 'TypeScript', 'Supabase', 'JWT · bcrypt', 'PWA', 'MIT'].map((tag) => (
              <div key={tag} style={{
                padding: '8px 16px',
                background: 'rgba(255,255,255,0.06)',
                border: '1px solid rgba(255,255,255,0.10)',
                borderRadius: 20,
                color: 'rgba(255,255,255,0.60)',
                fontSize: 15,
                fontWeight: 500,
              }}>
                {tag}
              </div>
            ))}
          </div>
        </div>
      </div>
    ),
    { ...size },
  )
}
