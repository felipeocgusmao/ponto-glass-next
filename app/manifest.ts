import type { MetadataRoute } from 'next'

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'PontoGlass',
    short_name: 'PontoGlass',
    description: 'Controle de ponto digital',
    start_url: '/',
    display: 'standalone',
    background_color: '#070714',
    theme_color: '#070714',
    icons: [
      { src: '/icon', sizes: '512x512', type: 'image/png', purpose: 'any' },
      { src: '/apple-icon', sizes: '180x180', type: 'image/png', purpose: 'any' },
    ],
  }
}
