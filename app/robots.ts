import type { MetadataRoute } from 'next'

// Instância privada: bloqueia indexação por qualquer crawler. O sistema não tem
// vitrine pública — quem entra na raiz é levado direto ao /login.
export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: '*',
        disallow: ['/'],
      },
    ],
  }
}
