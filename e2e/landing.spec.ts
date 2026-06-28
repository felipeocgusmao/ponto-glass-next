import { test, expect } from '@playwright/test'

test.describe('Root access (private instance)', () => {
  test('unauthenticated root redirects to /login', async ({ page }) => {
    await page.goto('/')
    await expect(page).toHaveURL(/\/login/)
  })

  test('login page shows username and password fields', async ({ page }) => {
    await page.goto('/login')
    await expect(page.getByRole('textbox').first()).toBeVisible()
    await expect(page.locator('input[type="password"]')).toBeVisible()
  })
})
