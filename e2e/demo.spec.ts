import { test, expect } from '@playwright/test'

test.describe('Demo page', () => {
  test('landing has a link to the demo page', async ({ page }) => {
    await page.goto('/')
    const demoLink = page.getByRole('link', { name: /demo/i }).first()
    await expect(demoLink).toBeVisible()
    await demoLink.click()
    await expect(page).toHaveURL(/\/demo/)
  })

  test('demo page shows credentials for all three roles', async ({ page }) => {
    await page.goto('/demo')
    const body = page.locator('body')
    await expect(body).toContainText(/admin/i)
    await expect(body).toContainText(/gerente|manager/i)
    await expect(body).toContainText(/funcion[aá]rio|employee/i)
  })

  test('demo page is noindex (no search engine indexing)', async ({ page }) => {
    const res = await page.goto('/demo')
    expect(res?.status()).toBeLessThan(400)
    // metadata.robots = { index: false } emits a `robots` meta tag containing "noindex"
    const robots = await page.locator('meta[name="robots"]').getAttribute('content')
    expect(robots ?? '').toMatch(/noindex/)
  })
})
