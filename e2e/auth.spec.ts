import { test, expect } from '@playwright/test'

test.describe('Authentication flow', () => {
  test('invalid credentials show error', async ({ page }) => {
    await page.goto('/login')
    await page.getByRole('textbox').first().fill('usuario_inexistente')
    await page.locator('input[type="password"]').fill('senha_errada')
    await page.getByRole('button', { name: /entrar/i }).click()
    await expect(page.locator('text=/inválid|incorret|erro/i')).toBeVisible({ timeout: 15000 })
  })

  test('/admin redirects unauthenticated users to /login', async ({ page }) => {
    await page.goto('/admin')
    await expect(page).toHaveURL(/\/login/)
  })

  test('/ponto redirects unauthenticated users to /login', async ({ page }) => {
    await page.goto('/ponto')
    await expect(page).toHaveURL(/\/login/)
  })

  test('/kiosk redirects unauthenticated users to /login', async ({ page }) => {
    await page.goto('/kiosk')
    await expect(page).toHaveURL(/\/login/)
  })
})
