import { test, expect } from '@playwright/test'

test.describe('SEO files', () => {
  test('robots.txt is served with the expected rules', async ({ request }) => {
    const res = await request.get('/robots.txt')
    expect(res.status()).toBe(200)
    const body = await res.text()
    expect(body).toMatch(/User-Agent:\s*\*/i)
    expect(body).toMatch(/Allow:\s*\/login/)
    expect(body).toMatch(/Disallow:\s*\/admin/)
    expect(body).toMatch(/Disallow:\s*\/api/)
  })

  test('sitemap.xml lists the public routes', async ({ request }) => {
    const res = await request.get('/sitemap.xml')
    expect(res.status()).toBe(200)
    const body = await res.text()
    expect(body).toContain('<urlset')
    expect(body).toMatch(/<loc>[^<]*\/login<\/loc>/)
    expect(body).toMatch(/<loc>[^<]*\/demo<\/loc>/)
  })

  test('opengraph-image renders as PNG', async ({ request }) => {
    const res = await request.get('/opengraph-image')
    expect(res.status()).toBe(200)
    expect(res.headers()['content-type'] ?? '').toMatch(/image\/png/)
  })

  test('landing page sets the metadataBase-based OG tags', async ({ page }) => {
    await page.goto('/')
    const ogType = await page.locator('meta[property="og:type"]').getAttribute('content')
    const ogTitle = await page.locator('meta[property="og:title"]').getAttribute('content')
    const ogImage = await page.locator('meta[property="og:image"]').getAttribute('content')
    expect(ogType).toBe('website')
    expect(ogTitle ?? '').toMatch(/PontoGlass/i)
    expect(ogImage ?? '').toMatch(/^https?:\/\/.+/) // absolute URL via metadataBase
  })
})
