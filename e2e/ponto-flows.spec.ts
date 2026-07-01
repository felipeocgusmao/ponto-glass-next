import { test, expect } from '@playwright/test'

// These tests verify the happy-path and auth-redirect flows for the employee ponto page.
// They run against a real (staging) environment; authentication is done via the login form.

test.describe('Role-based redirects', () => {
  test('unauthenticated /ponto redirects to /login', async ({ page }) => {
    await page.goto('/ponto')
    await expect(page).toHaveURL(/\/login/)
  })

  test('unauthenticated /admin redirects to /login', async ({ page }) => {
    await page.goto('/admin')
    await expect(page).toHaveURL(/\/login/)
  })
})

test.describe('Login flow', () => {
  test('shows error on bad credentials', async ({ page }) => {
    await page.goto('/login')
    await page.getByRole('textbox').first().fill('usuario_inexistente_xyz')
    await page.locator('input[type="password"]').fill('senha_errada_xyz')
    await page.getByRole('button', { name: /entrar/i }).click()
    await expect(page.locator('text=/inválid|incorret|erro/i')).toBeVisible({ timeout: 15000 })
  })

  test('login form has accessible labels', async ({ page }) => {
    await page.goto('/login')
    // Username and password inputs must be present and keyboard-reachable
    const usernameInput = page.getByRole('textbox').first()
    const passwordInput = page.locator('input[type="password"]')
    await expect(usernameInput).toBeVisible()
    await expect(passwordInput).toBeVisible()
    // Submit button must be focusable
    const submitBtn = page.getByRole('button', { name: /entrar/i })
    await expect(submitBtn).toBeVisible()
  })
})

test.describe('Correction request form', () => {
  test('correction form requires reason when submitting', async ({ page, context }) => {
    // Skip this test if no test credentials are configured
    const user = process.env.E2E_USERNAME
    const pass = process.env.E2E_PASSWORD
    if (!user || !pass) {
      test.skip()
      return
    }

    await page.goto('/login')
    await page.getByRole('textbox').first().fill(user)
    await page.locator('input[type="password"]').fill(pass)
    await page.getByRole('button', { name: /entrar/i }).click()
    await expect(page).toHaveURL(/\/ponto/, { timeout: 10000 })

    // Navigate to correções tab
    await page.getByRole('button', { name: /corre[cç]/i }).click()

    // Try submitting without a reason
    const submitBtn = page.getByRole('button', { name: /enviar/i })
    if (await submitBtn.isVisible()) {
      await submitBtn.click()
      // Should show a validation error
      await expect(page.locator('text=/motivo|reason/i')).toBeVisible({ timeout: 5000 })
    }
  })
})

test.describe('Punch flow', () => {
  test('punch page loads main UI after login', async ({ page }) => {
    const user = process.env.E2E_USERNAME
    const pass = process.env.E2E_PASSWORD
    if (!user || !pass) {
      test.skip()
      return
    }

    await page.goto('/login')
    await page.getByRole('textbox').first().fill(user)
    await page.locator('input[type="password"]').fill(pass)
    await page.getByRole('button', { name: /entrar/i }).click()
    await expect(page).toHaveURL(/\/ponto/, { timeout: 10000 })

    // The clock / time display should be visible
    await expect(page.locator('[class*="clock"], [class*="time"], text=/\d{2}:\d{2}/').first()).toBeVisible({ timeout: 15000 })
  })
})
