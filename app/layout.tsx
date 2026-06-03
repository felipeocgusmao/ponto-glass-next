import type { Metadata, Viewport } from 'next'
import './globals.css'
import Providers from './providers'
import { SpeedInsights } from '@vercel/speed-insights/next'
import { Analytics } from '@vercel/analytics/next'

export const viewport: Viewport = {
  themeColor: '#08090b',
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
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
    index: true,
    follow: true,
  },
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR" data-theme="dark" data-accent="indigo" suppressHydrationWarning>
      <head>
        <link rel="icon" href="/icon.svg" type="image/svg+xml" />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        <link
          href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&family=JetBrains+Mono:wght@400;500&display=swap"
          rel="stylesheet"
        />
      </head>
      <body>
        <Providers>{children}</Providers>
        <SpeedInsights />
        <Analytics />
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){try{var t=localStorage.getItem('pg.theme');if(t)document.documentElement.setAttribute('data-theme',t);}catch(e){}})();if('serviceWorker'in navigator)navigator.serviceWorker.register('/sw.js')`,
          }}
        />
      </body>
    </html>
  )
}
