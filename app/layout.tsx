import type { Metadata, Viewport } from 'next'
import { Inter, JetBrains_Mono, Lora } from 'next/font/google'
import './globals.css'
import './styles/tokens.css'
import './styles/layout.css'
import './styles/components.css'
import './styles/login.css'
import './styles/employee.css'
import Providers from './providers'
import { SpeedInsights } from '@vercel/speed-insights/next'
import { Analytics } from '@vercel/analytics/next'
import { ServiceWorkerRegistration } from './_components/ServiceWorkerRegistration'
import { GlassHighlight } from './_components/GlassHighlight'

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-inter',
  display: 'swap',
  weight: ['300', '400', '500', '600', '700'],
})

const jetbrainsMono = JetBrains_Mono({
  subsets: ['latin'],
  variable: '--font-jetbrains',
  display: 'swap',
  weight: ['400', '500'],
})

const lora = Lora({
  subsets: ['latin'],
  variable: '--font-lora',
  display: 'swap',
  weight: ['400', '600'],
  style: ['normal', 'italic'],
})

export const viewport: Viewport = {
  // Deliberately NO themeColor here. A flat theme-color makes iOS Safari paint
  // an opaque band behind its collapsed top/bottom bars, which can never match
  // the app's gradient background (the recurring "barra preta/branca" — #248,
  // #269). And it can't just be removed at runtime either: metas rendered here
  // are part of the React tree, so hydration resurrects whatever a pre-paint
  // script deletes (why #269 didn't stick). Instead the boot script CREATES the
  // meta outside the React tree on non-iOS platforms only — Android Chrome uses
  // it for the status-bar tint, where a flat color is correct.
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  // Extend the page edge-to-edge so the background gradient fills the notch /
  // home-indicator safe areas instead of leaving solid black bars on iOS.
  viewportFit: 'cover',
}

export const metadata: Metadata = {
  metadataBase: new URL('https://ponto-glass-next.vercel.app'),
  title: {
    default: 'PontoGlass — o tempo, finalmente, tem forma',
    template: '%s · PontoGlass',
  },
  description: 'Sistema de ponto digital — leve, seguro e bonito. JWT, PWA, push notifications, geofencing, multi-idioma. Open source.',
  applicationName: 'PontoGlass',
  authors: [{ name: 'Felipe Gusmão', url: 'https://github.com/felipeocgusmao' }],
  keywords: ['ponto eletrónico', 'ponto digital', 'time tracking', 'controle de ponto', 'PWA', 'Next.js', 'Supabase', 'TypeScript'],
  manifest: '/manifest.json',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
    title: 'PontoGlass',
  },
  openGraph: {
    type: 'website',
    locale: 'pt_BR',
    url: 'https://ponto-glass-next.vercel.app',
    siteName: 'PontoGlass',
    title: 'PontoGlass — o tempo, finalmente, tem forma',
    description: 'Sistema de ponto digital — leve, seguro e bonito. JWT, PWA, push notifications, geofencing, multi-idioma. Open source.',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'PontoGlass — o tempo, finalmente, tem forma',
    description: 'Sistema de ponto digital — leve, seguro e bonito. Open source.',
  },
  robots: {
    index: false,
    follow: false,
    nocache: true,
    googleBot: {
      index: false,
      follow: false,
    },
  },
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR" data-theme="dark" data-accent="indigo" suppressHydrationWarning
      className={`${inter.variable} ${jetbrainsMono.variable} ${lora.variable}`}
    >
      <head>
        <link rel="icon" href="/icon.svg" type="image/svg+xml" />
      </head>
      <body>
        <a href="#main-content" className="skip-link">Ir para o conteúdo principal</a>
        {/* Liquid-glass refraction filter (#218, experimental) — hidden, referenced
            via backdrop-filter: url(#glass-distort) in components.css. Subtle
            displacement (scale=14): a lens-like warp, not heavy distortion. */}
        <svg width="0" height="0" style={{ position: 'absolute' }} aria-hidden="true">
          <filter id="glass-distort" x="-20%" y="-20%" width="140%" height="140%">
            <feTurbulence type="fractalNoise" baseFrequency="0.012 0.012" numOctaves={2} seed={7} result="noise" />
            <feDisplacementMap in="SourceGraphic" in2="noise" scale={14} xChannelSelector="R" yChannelSelector="G" />
          </filter>
        </svg>
        <Providers>{children}</Providers>
        <SpeedInsights />
        <Analytics />
        <ServiceWorkerRegistration />
        <GlassHighlight />
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){try{var r=document.documentElement;var t=localStorage.getItem('pg.theme');if(t){r.setAttribute('data-theme',t);}else{r.setAttribute('data-theme',window.matchMedia('(prefers-color-scheme: dark)').matches?'dark':'light');}var a=localStorage.getItem('pg.accent');if(a)r.setAttribute('data-accent',a);var f=localStorage.getItem('pg.font');if(f)r.setAttribute('data-font',f);var ios=/iPad|iPhone|iPod/.test(navigator.userAgent)||(navigator.platform==='MacIntel'&&navigator.maxTouchPoints>1);if(!ios){var c=r.getAttribute('data-theme')==='dark'?'#08090b':'#fafafa';var m=document.querySelector('meta[name="theme-color"]');if(!m){m=document.createElement('meta');m.setAttribute('name','theme-color');document.head.appendChild(m);}m.setAttribute('content',c);}}catch(e){}})()`,
          }}
        />
      </body>
    </html>
  )
}
