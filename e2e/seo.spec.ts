import { test, expect } from '@playwright/test'

test.describe('SEO / privacy files', () => {
  test('robots.txt disallows all crawlers', async ({ request }) => {
    const res = await request.get('/robots.txt')
    expect(res.status()).toBe(200)
    const body = await res.text()
    expect(body).toMatch(/User-Agent:\s*\*/i)
    expect(body).toMatch(/Disallow:\s*\//)
  })

  test('sitemap.xml is not served (private instance)', async ({ request }) => {
    // The route no longer exists AND the middleware login-gates unknown paths,
    // so the request lands on /login (redirect followed) — either way, no XML.
    const res = await request.get('/sitemap.xml')
    expect(res.url()).toMatch(/\/login/)
    expect(res.headers()['content-type'] ?? '').not.toMatch(/xml/)
  })

  test('opengraph-image renders as PNG', async ({ request }) => {
    const res = await request.get('/opengraph-image')
    expect(res.status()).toBe(200)
    expect(res.headers()['content-type'] ?? '').toMatch(/image\/png/)
  })

  test('login page is noindex', async ({ page }) => {
    await page.goto('/login')
    const robots = await page.locator('meta[name="robots"]').getAttribute('content')
    expect(robots ?? '').toMatch(/noindex/)
  })
})
