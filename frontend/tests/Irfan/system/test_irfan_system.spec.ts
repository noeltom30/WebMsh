import { expect, test } from '@playwright/test'

test('IRF-ST-001 home page title contains WebMsh', async ({ page }) => {
  await page.goto('/')
  await expect(page).toHaveTitle(/WebMsh/i)
})

test('IRF-ST-002 brand link is visible', async ({ page }) => {
  await page.goto('/')
  await expect(page.getByRole('link', { name: 'WebMsh' })).toBeVisible()
})

test('IRF-ST-003 auth route loads', async ({ page }) => {
  await page.goto('/auth')
  await expect(page.getByRole('button', { name: 'Sign In', exact: true })).toBeVisible()
})

test('IRF-ST-004 unknown route redirects to app shell', async ({ page }) => {
  await page.goto('/some-unknown-route')
  await expect(page.getByRole('link', { name: 'WebMsh' })).toBeVisible()
})
