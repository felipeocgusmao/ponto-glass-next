import type { MetadataRoute } from 'next'

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: '*',
        allow: ['/', '/login', '/demo'],
        disallow: ['/admin', '/ponto', '/kiosk', '/api', '/reset-password'],
      },
    ],
    sitemap: 'https://ponto-glass-next.vercel.app/sitemap.xml',
  }
}
