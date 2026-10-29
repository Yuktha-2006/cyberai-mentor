import { expect, test } from '@playwright/test'

test('signs in and loads the dashboard with mocked API responses', async ({ page }) => {
  await page.route('**/api/v1/**', async route => {
    const path = new URL(route.request().url()).pathname
    const responses: Record<string, unknown> = {
      '/api/v1/auth/login': { message: 'Login successful' },
      '/api/v1/auth/me': {
        id: 'user-1',
        email: 'learner@example.com',
        full_name: 'Test Learner',
        role: 'learner',
        xp_total: 0,
        level: 1,
        onboarding_completed: true,
      },
      '/api/v1/learn/modules': [],
      '/api/v1/learn/progress': {
        completed_lessons: [],
        quiz_best_scores: {},
        xp_total: 0,
        level: 1,
      },
    }

    await route.fulfill({
      status: path in responses ? 200 : 404,
      contentType: 'application/json',
      body: JSON.stringify(responses[path] ?? { detail: 'Not found' }),
    })
  })

  await page.goto('/login')
  await page.getByLabel('Email address').fill('learner@example.com')
  await page.getByRole('textbox', { name: 'Password' }).fill('SecurePassword123')
  await page.getByRole('button', { name: 'Sign In' }).click()

  await expect(page.getByRole('heading', { name: /Welcome back, Test/ })).toBeVisible()
  await expect(page.getByText('Total XP')).toBeVisible()
})