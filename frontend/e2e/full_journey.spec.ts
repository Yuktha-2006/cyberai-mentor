import { readdir, readFile } from 'node:fs/promises'
import path from 'node:path'
import ts from 'typescript'
import { expect, test } from '@playwright/test'

const appDirectory = path.resolve(__dirname, '../app')

async function findPages(directory: string): Promise<string[]> {
  const entries = await readdir(directory, { withFileTypes: true })
  const files = await Promise.all(entries.map(async entry => {
    const entryPath = path.join(directory, entry.name)
    if (entry.isDirectory()) return findPages(entryPath)
    return entry.name === 'page.tsx' ? [entryPath] : []
  }))
  return files.flat()
}

function staticAttributeValue(attribute: ts.JsxAttribute | undefined): string | undefined {
  if (!attribute?.initializer) return undefined
  if (ts.isStringLiteral(attribute.initializer)) return attribute.initializer.text
  if (ts.isJsxExpression(attribute.initializer) && attribute.initializer.expression) {
    const expression = attribute.initializer.expression
    if (ts.isStringLiteral(expression) || ts.isNoSubstitutionTemplateLiteral(expression)) return expression.text
  }
  return undefined
}

function routePattern(pagePath: string): RegExp {
  const segments = path.relative(appDirectory, pagePath)
    .split(path.sep)
    .slice(0, -1)
    .filter(segment => !(segment.startsWith('(') && segment.endsWith(')')))
  const pattern = segments.map(segment => {
    if (segment.startsWith('[') && segment.endsWith(']')) return '[^/]+'
    return segment.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  }).join('/')
  return new RegExp(`^/${pattern}/?$`)
}

test('all static page links target a route or an existing landing-page section, and buttons are actionable', async () => {
  const pages = await findPages(appDirectory)
  const routePatterns = pages.map(routePattern)
  const landingPath = path.join(appDirectory, 'page.tsx')
  const landingSourceText = await readFile(landingPath, 'utf8')
  const landingIds = new Set(Array.from(
    landingSourceText.matchAll(/\bid="([^"]+)"/g),
    match => match[1],
  ))
  const findings: string[] = []

  for (const pagePath of pages) {
    const sourceText = await readFile(pagePath, 'utf8')
    const source = ts.createSourceFile(pagePath, sourceText, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX)
    const relativePath = path.relative(appDirectory, pagePath)

    const inspect = (node: ts.Node) => {
      if (ts.isJsxOpeningElement(node) || ts.isJsxSelfClosingElement(node)) {
        const tagName = node.tagName.getText(source)
        const attributes = node.attributes.properties.filter(ts.isJsxAttribute)
        const attribute = (name: string) => attributes.find(item => item.name.getText(source) === name)

        if (tagName === 'button') {
          const type = staticAttributeValue(attribute('type'))
          if (!attribute('onClick') && type !== 'submit') {
            findings.push(`${relativePath}: button needs onClick or type="submit"`)
          }
        }

        if (tagName === 'Link' || tagName === 'a') {
          const href = staticAttributeValue(attribute('href'))
          if (href === '#') findings.push(`${relativePath}: empty fragment link`)
          else if (href?.startsWith('#')) {
            if (!landingIds.has(href.slice(1))) findings.push(`${relativePath}: missing landing anchor ${href}`)
          } else if (href?.startsWith('/')) {
            const pathname = new URL(href, 'http://localhost').pathname
            if (!routePatterns.some(pattern => pattern.test(pathname))) {
              findings.push(`${relativePath}: no page route for ${pathname}`)
            }
          }
        }
      }
      ts.forEachChild(node, inspect)
    }

    inspect(source)
  }

  expect(findings, findings.join('\n')).toEqual([])
})

test('completes a real learner journey without CORS, 400, or 500 API errors', async ({ page }) => {
  test.skip(!!process.env.CI, 'Requires a local backend and database');
  test.setTimeout(180_000)

  const apiOrigin = 'http://localhost:8000'
  const apiErrors: string[] = []
  const apiRequestFailures: string[] = []
  const corsConsoleErrors: string[] = []

  page.on('response', response => {
    if (new URL(response.url()).origin === apiOrigin && response.status() >= 400) {
      apiErrors.push(`${response.status()} ${response.request().method()} ${response.url()}`)
    }
  })
  page.on('requestfailed', request => {
    if (new URL(request.url()).origin === apiOrigin) {
      apiRequestFailures.push(`${request.url()}: ${request.failure()?.errorText ?? 'request failed'}`)
    }
  })
  page.on('console', message => {
    if (message.type() === 'error' && /cors|failed to fetch/i.test(message.text())) {
      corsConsoleErrors.push(message.text())
    }
  })

  await page.goto('/')
  await expect(page.getByRole('heading', { name: /Master Cybersecurity/ })).toBeVisible()

  const mainNavigation = page.getByRole('navigation', { name: 'Main navigation' })
  for (const [label, target] of [
    ['Features', 'features'],
    ['Career Paths', 'careers'],
    ['Labs', 'labs'],
    ['Pricing', 'pricing'],
  ]) {
    await mainNavigation.getByRole('link', { name: label, exact: true }).click()
    await expect(page).toHaveURL(new RegExp(`#${target}$`))
    await expect(page.locator(`#${target}`)).toBeAttached()
  }

  await page.getByRole('link', { name: 'See the Labs' }).click()
  await expect(page).toHaveURL(/#labs$/)
  await mainNavigation.getByRole('link', { name: 'Sign In', exact: true }).click()
  await expect(page).toHaveURL(/\/login$/)
  await page.goto('/')
  await mainNavigation.getByRole('link', { name: 'Get Started Free', exact: true }).click()
  await expect(page).toHaveURL(/\/register$/)

  await page.getByRole('link', { name: 'Terms of Service' }).click()
  await expect(page.getByRole('heading', { name: 'Terms of Service' })).toBeVisible()
  await page.goto('/register')
  await page.getByRole('link', { name: 'Privacy Policy' }).click()
  await expect(page.getByRole('heading', { name: 'Privacy Notice' })).toBeVisible()
  await page.goto('/register')

  const email = `qa-robot-${Date.now()}@example.com`
  const password = 'SecurePassword123'
  await page.getByLabel('Full name').fill('QA Robot')
  await page.getByLabel('Email address').fill(email)
  const registrationPassword = page.getByLabel('Password', { exact: true })
  await registrationPassword.fill(password)
  await page.getByLabel('Confirm password').fill(password)
  await page.getByRole('button', { name: 'Show password' }).click()
  await expect(registrationPassword).toHaveAttribute('type', 'text')
  await page.getByRole('button', { name: 'Hide password' }).click()
  await expect(registrationPassword).toHaveAttribute('type', 'password')
  await page.getByRole('checkbox').check()

  const registrationResponse = page.waitForResponse(response =>
    response.url().endsWith('/api/v1/auth/register') && response.request().method() === 'POST',
  )
  await page.getByRole('button', { name: /Create Free Account/ }).click()
  expect((await registrationResponse).status()).toBe(201)
  await expect(page).toHaveURL(/\/onboarding$/)

  await page.getByRole('button', { name: /^SOC Analyst/ }).click()
  await page.getByRole('button', { name: 'Continue', exact: true }).click()
  await page.getByRole('button', { name: /^Complete Beginner/ }).click()
  await page.getByRole('button', { name: 'Start Assessment' }).click()

  const correctAnswers = [
    '443',
    'Active connection state',
    'A03: Injection',
    'XSS',
    'Preparation',
    'Brute force / credential stuffing',
    'CRYSTALS-Kyber',
    'Integrity',
    'IAM',
    'Grant only the permissions needed for a specific task',
  ]
  for (let index = 0; index < correctAnswers.length; index += 1) {
    await page.locator('button').filter({ hasText: correctAnswers[index] }).last().click()
    await page.getByRole('button', { name: index === correctAnswers.length - 1 ? 'Finish Assessment' : 'Next', exact: true }).click()
  }
  await expect(page).toHaveURL(/\/dashboard$/)

  await expect(page.getByRole('heading', { name: /Welcome back, QA/ })).toBeVisible()
  await expect(page.getByText('Total XP', { exact: true })).toBeVisible()
  await expect(page.getByText('Skill Levels', { exact: true })).toBeVisible()
  await expect(page.getByText('Available Modules', { exact: true })).toBeVisible()

  const dashboardNavigation = page.getByRole('navigation', { name: 'Dashboard navigation' })
  await dashboardNavigation.getByRole('link', { name: 'My Progress' }).click()
  await expect(page.getByRole('heading', { name: 'My Progress' })).toBeVisible()
  await page.getByRole('link', { name: 'Dashboard' }).click()
  await dashboardNavigation.getByRole('link', { name: 'Achievements' }).click()
  await expect(page.getByRole('heading', { name: 'Achievements' })).toBeVisible()
  await page.getByRole('link', { name: 'Dashboard' }).click()

  await dashboardNavigation.getByRole('link', { name: 'AI Mentor' }).click()
  await expect(page.getByText('CyberMentor Autonomous Agent')).toBeVisible()
  const mentorPrompt = 'Explain what a SIEM does in one sentence.'
  await page.getByPlaceholder(/Ask anything/).fill(mentorPrompt)
  const mentorResponse = page.waitForResponse(response =>
    response.url().endsWith('/api/v1/mentor/chat') && response.request().method() === 'POST',
  )
  await page.getByRole('button', { name: 'Send message' }).click()
  const mentorResult = await mentorResponse
  expect(mentorResult.status()).toBe(200)
  const mentorReply = (await mentorResult.json()).reply as string
  expect(mentorReply.trim().length).toBeGreaterThan(0)
  await expect(page.locator('main')).toContainText(mentorReply.trim().split('\n').filter(Boolean)[0].slice(0, 40))

  await page.getByRole('link', { name: 'Dashboard' }).click()
  await dashboardNavigation.getByRole('link', { name: 'Labs' }).click()
  const alertRow = page.getByRole('row').filter({ hasText: '45.33.32.156' }).first()
  await expect(alertRow).toBeVisible()
  await alertRow.locator('button[title="Inspect Payload"]').click()
  await page.getByRole('button', { name: 'Isolate Source IP (DROP)' }).click()
  await expect(page.getByText('DROP 45.33.32.156')).toBeVisible()
  await expect(page.getByText('Active Containment Rules (1)')).toBeVisible()

  await page.getByRole('link', { name: 'Dashboard' }).click()
  await dashboardNavigation.getByRole('link', { name: 'Learn', exact: true }).click()
  await expect(page.getByRole('heading', { name: 'Security Training Modules' })).toBeVisible()
  await page.getByRole('link', { name: /Network Defense & Traffic Analysis/ }).click()
  await page.getByRole('button', { name: 'Quiz Evaluation', exact: true }).click()
  await expect(page.getByRole('heading', { name: 'Network Defense Certification Quiz' })).toBeVisible()

  const questionHeadings = page.getByRole('heading', { name: /^Q\d+\./ })
  const questionCount = await questionHeadings.count()
  expect(questionCount).toBeGreaterThan(0)
  for (let index = 0; index < questionCount; index += 1) {
    const questionCard = questionHeadings.nth(index).locator('..').locator('..')
    await questionCard.getByRole('button').first().click()
  }
  const quizResponse = page.waitForResponse(response =>
    /\/api\/v1\/learn\/quizzes\/[^/]+\/submit$/.test(response.url()) && response.request().method() === 'POST',
  )
  await page.getByRole('button', { name: 'Submit for Evaluation' }).click()
  expect((await quizResponse).status()).toBe(200)
  await expect(page.getByText(/\(\d+(\.\d+)?% earned\)/)).toBeVisible()
  await page.getByRole('link', { name: 'Return to Dashboard' }).click()

  await page.getByRole('button', { name: 'Sign Out' }).click()
  await expect(page).toHaveURL(/\/login$/)
  await page.getByRole('link', { name: 'Forgot password?' }).click()
  await expect(page.getByRole('heading', { name: 'Reset your password' })).toBeVisible()
  await page.getByLabel('Email address').fill(email)
  await page.getByRole('button', { name: 'Send Reset Link' }).click()
  await expect(page.getByText('If an account exists, a reset link has been sent.', { exact: true })).toBeVisible()

  expect(apiErrors, apiErrors.join('\n')).toEqual([])
  expect(apiRequestFailures, apiRequestFailures.join('\n')).toEqual([])
  expect(corsConsoleErrors, corsConsoleErrors.join('\n')).toEqual([])
})

test('mobile navigation links remain reachable', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto('/')
  await page.getByRole('button', { name: 'Open menu' }).click()
  await page.getByRole('navigation', { name: 'Main navigation' }).getByRole('link', { name: 'Career Paths', exact: true }).click()
  await expect(page).toHaveURL(/#careers$/)
  await expect(page.locator('#careers')).toBeAttached()
  await expect(page.getByRole('button', { name: 'Open menu' })).toBeVisible()
})
