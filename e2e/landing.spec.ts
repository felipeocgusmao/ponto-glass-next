import { test, expect } from '@playwright/test'

test.describe('Landing page', () => {
  test('shows hero and login link when unauthenticated', async ({ page }) => {
    await page.goto('/')
    await expect(page.getByRole('link', { name: /entrar/i }).first()).toBeVisible()
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible()
  })

  test('login link navigates to /login', async ({ page }) => {
    await page.goto('/')
    await page.getByRole('link', { name: /aceder ao sistema/i }).click()
    await expect(page).toHaveURL(/\/login/)
  })

  test('login page shows username and password fields', async ({ page }) => {
    await page.goto('/login')
    await expect(page.getByRole('textbox').first()).toBeVisible()
    await expect(page.locator('input[type="password"]')).toBeVisible()
  })
})
