import { cleanup, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, expect, it, vi } from 'vitest'
import LoginPage from '../app/(auth)/login/page'

const router = vi.hoisted(() => ({ push: vi.fn(), replace: vi.fn() }))

vi.mock('next/navigation', () => ({ useRouter: () => router }))
vi.mock('next/link', () => ({
  default: ({ href, children }: { href: string; children: React.ReactNode }) => (
    <a href={href}>{children}</a>
  ),
}))
vi.mock('react-hot-toast', () => ({
  default: { success: vi.fn(), error: vi.fn() },
}))

afterEach(() => {
  cleanup()
  vi.clearAllMocks()
})

it('shows login validation and lets the user reveal the password', async () => {
  const user = userEvent.setup()
  render(<LoginPage />)

  await user.type(screen.getByLabelText('Email address'), 'not-an-email')
  await user.type(screen.getByLabelText('Password'), 'short')
  await user.click(screen.getByRole('button', { name: 'Sign In' }))

  expect(await screen.findByText('Enter a valid email address')).toBeInTheDocument()
  expect(screen.getByText('Password must be at least 8 characters')).toBeInTheDocument()

  const password = screen.getByLabelText('Password')
  expect(password).toHaveAttribute('type', 'password')
  await user.click(screen.getByRole('button', { name: 'Show password' }))
  expect(password).toHaveAttribute('type', 'text')
})