'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Shield, Eye, EyeOff, ArrowRight, Loader2, CheckCircle } from 'lucide-react'
import toast from 'react-hot-toast'
import { z } from 'zod'

const schema = z.object({
  full_name: z.string().min(2, 'Name must be at least 2 characters').max(100),
  email: z.string().email('Enter a valid email address'),
  password: z
    .string()
    .min(8, 'Password must be at least 8 characters')
    .regex(/[A-Z]/, 'Must contain an uppercase letter')
    .regex(/[0-9]/, 'Must contain a number'),
  confirm_password: z.string(),
  agreed: z.literal(true, { errorMap: () => ({ message: 'You must accept the terms' }) }),
}).refine(d => d.password === d.confirm_password, {
  message: "Passwords don't match",
  path: ['confirm_password'],
})

function strengthLabel(pw: string): { label: string; color: string; width: string } {
  let score = 0
  if (pw.length >= 8) score++
  if (/[A-Z]/.test(pw)) score++
  if (/[0-9]/.test(pw)) score++
  if (/[^A-Za-z0-9]/.test(pw)) score++
  if (pw.length >= 14) score++
  if (score <= 1) return { label: 'Weak', color: '#f43f5e', width: '20%' }
  if (score <= 2) return { label: 'Fair', color: '#f59e0b', width: '50%' }
  if (score <= 3) return { label: 'Good', color: '#06b6d4', width: '75%' }
  return { label: 'Strong', color: '#10b981', width: '100%' }
}

export default function RegisterPage() {
  const router = useRouter()
  const [form, setForm] = useState({ full_name: '', email: '', password: '', confirm_password: '', agreed: false })
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [showPw, setShowPw] = useState(false)
  const [loading, setLoading] = useState(false)
  const strength = form.password ? strengthLabel(form.password) : null

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setErrors({})

    const result = schema.safeParse({ ...form, agreed: form.agreed || undefined })
    if (!result.success) {
      const fieldErrors: Record<string, string> = {}
      result.error.errors.forEach(err => {
        if (err.path[0]) fieldErrors[err.path[0] as string] = err.message
      })
      setErrors(fieldErrors)
      return
    }

    setLoading(true)
    try {
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'
      const res = await fetch(`${apiUrl}/api/v1/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ full_name: form.full_name, email: form.email, password: form.password }),
      })

      const data = await res.json()

      if (!res.ok) {
        if (res.status === 409) {
          setErrors({ email: 'An account with this email already exists.' })
        } else {
          toast.error(data.detail || 'Registration failed. Please try again.')
        }
        return
      }

      toast.success('Account created! Let\'s set up your learning profile.')
      router.push('/onboarding')
    } catch {
      toast.error('Network error. Is the server running?')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4 py-12" style={{ backgroundColor: '#0a0f1e' }}>
      <div className="fixed inset-0 bg-grid pointer-events-none" aria-hidden />

      <div className="relative w-full max-w-md">
        <div className="text-center mb-8">
          <Link href="/" className="inline-flex items-center gap-2 mb-4">
            <div className="w-10 h-10 rounded-xl flex items-center justify-center shadow-cyber" style={{ background: 'linear-gradient(135deg,#06b6d4,#7c3aed)' }}>
              <Shield className="w-5 h-5 text-white" />
            </div>
          </Link>
          <h1 className="text-2xl font-bold text-white">Start your journey</h1>
          <p className="text-slate-400 text-sm mt-1">Free account — no credit card required</p>
        </div>

        <div className="glass-strong rounded-2xl p-8" style={{ border: '1px solid rgba(6,182,212,0.15)' }}>
          <form onSubmit={handleSubmit} noValidate className="space-y-5">
            {/* Full name */}
            <div>
              <label htmlFor="reg-name" className="block text-sm font-medium text-slate-300 mb-1.5">Full name</label>
              <input
                id="reg-name"
                type="text"
                autoComplete="name"
                value={form.full_name}
                onChange={e => setForm(f => ({ ...f, full_name: e.target.value }))}
                placeholder="Priya Sharma"
                aria-invalid={!!errors.full_name}
                aria-describedby={errors.full_name ? 'reg-name-error' : undefined}
                className="w-full px-4 py-3 rounded-xl text-white placeholder-slate-600 text-sm focus:outline-none focus:ring-2 focus:ring-cyan-400 transition-all"
                style={{ background: 'rgba(255,255,255,0.05)', border: errors.full_name ? '1px solid rgba(244,63,94,0.6)' : '1px solid rgba(255,255,255,0.1)' }}
              />
              {errors.full_name && <p id="reg-name-error" className="text-rose-400 text-xs mt-1" role="alert">{errors.full_name}</p>}
            </div>

            {/* Email */}
            <div>
              <label htmlFor="reg-email" className="block text-sm font-medium text-slate-300 mb-1.5">Email address</label>
              <input
                id="reg-email"
                type="email"
                autoComplete="email"
                value={form.email}
                onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
                placeholder="you@example.com"
                aria-invalid={!!errors.email}
                aria-describedby={errors.email ? 'reg-email-error' : undefined}
                className="w-full px-4 py-3 rounded-xl text-white placeholder-slate-600 text-sm focus:outline-none focus:ring-2 focus:ring-cyan-400 transition-all"
                style={{ background: 'rgba(255,255,255,0.05)', border: errors.email ? '1px solid rgba(244,63,94,0.6)' : '1px solid rgba(255,255,255,0.1)' }}
              />
              {errors.email && <p id="reg-email-error" className="text-rose-400 text-xs mt-1" role="alert">{errors.email}</p>}
            </div>

            {/* Password */}
            <div>
              <label htmlFor="reg-password" className="block text-sm font-medium text-slate-300 mb-1.5">Password</label>
              <div className="relative">
                <input
                  id="reg-password"
                  type={showPw ? 'text' : 'password'}
                  autoComplete="new-password"
                  value={form.password}
                  onChange={e => setForm(f => ({ ...f, password: e.target.value }))}
                  placeholder="Min. 8 characters"
                  aria-invalid={!!errors.password}
                  aria-describedby="reg-pw-strength reg-pw-error"
                  className="w-full px-4 py-3 pr-11 rounded-xl text-white placeholder-slate-600 text-sm focus:outline-none focus:ring-2 focus:ring-cyan-400 transition-all"
                  style={{ background: 'rgba(255,255,255,0.05)', border: errors.password ? '1px solid rgba(244,63,94,0.6)' : '1px solid rgba(255,255,255,0.1)' }}
                />
                <button type="button" onClick={() => setShowPw(!showPw)} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300 transition-colors" aria-label={showPw ? 'Hide password' : 'Show password'}>
                  {showPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
              {/* Strength bar */}
              {strength && (
                <div id="reg-pw-strength" className="mt-2" aria-live="polite">
                  <div className="h-1 rounded-full bg-white/10 overflow-hidden">
                    <div className="h-full rounded-full transition-all duration-300" style={{ width: strength.width, background: strength.color }} />
                  </div>
                  <p className="text-xs mt-1" style={{ color: strength.color }}>{strength.label}</p>
                </div>
              )}
              {errors.password && <p id="reg-pw-error" className="text-rose-400 text-xs mt-1" role="alert">{errors.password}</p>}
            </div>

            {/* Confirm password */}
            <div>
              <label htmlFor="reg-confirm" className="block text-sm font-medium text-slate-300 mb-1.5">Confirm password</label>
              <input
                id="reg-confirm"
                type="password"
                autoComplete="new-password"
                value={form.confirm_password}
                onChange={e => setForm(f => ({ ...f, confirm_password: e.target.value }))}
                placeholder="••••••••"
                aria-invalid={!!errors.confirm_password}
                aria-describedby={errors.confirm_password ? 'reg-confirm-error' : undefined}
                className="w-full px-4 py-3 rounded-xl text-white placeholder-slate-600 text-sm focus:outline-none focus:ring-2 focus:ring-cyan-400 transition-all"
                style={{ background: 'rgba(255,255,255,0.05)', border: errors.confirm_password ? '1px solid rgba(244,63,94,0.6)' : '1px solid rgba(255,255,255,0.1)' }}
              />
              {form.confirm_password && form.password === form.confirm_password && (
                <p className="text-emerald-400 text-xs mt-1 flex items-center gap-1"><CheckCircle className="w-3 h-3" /> Passwords match</p>
              )}
              {errors.confirm_password && <p id="reg-confirm-error" className="text-rose-400 text-xs mt-1" role="alert">{errors.confirm_password}</p>}
            </div>

            {/* Terms */}
            <div className="flex items-start gap-3">
              <input
                id="reg-terms"
                type="checkbox"
                checked={form.agreed}
                onChange={e => setForm(f => ({ ...f, agreed: e.target.checked }))}
                aria-describedby={errors.agreed ? 'reg-terms-error' : undefined}
                className="mt-0.5 w-4 h-4 rounded accent-cyan-400 flex-shrink-0"
              />
              <label htmlFor="reg-terms" className="text-slate-400 text-sm leading-relaxed">
                I agree to the{' '}
                <Link href="/terms" className="text-cyan-400 hover:text-cyan-300 transition-colors">Terms of Service</Link>
                {' '}and{' '}
                <Link href="/privacy" className="text-cyan-400 hover:text-cyan-300 transition-colors">Privacy Policy</Link>
              </label>
            </div>
            {errors.agreed && <p id="reg-terms-error" className="text-rose-400 text-xs -mt-3" role="alert">{errors.agreed}</p>}

            {/* Submit */}
            <button
              type="submit"
              id="register-submit"
              disabled={loading}
              className="w-full flex items-center justify-center gap-2 py-3 px-6 rounded-xl font-semibold text-white transition-all hover:opacity-90 disabled:opacity-60 disabled:cursor-not-allowed focus-visible-ring"
              style={{ background: 'linear-gradient(135deg,#06b6d4,#7c3aed)' }}
            >
              {loading ? <><Loader2 className="w-4 h-4 animate-spin" /> Creating account…</> : <>Create Free Account <ArrowRight className="w-4 h-4" /></>}
            </button>
          </form>

          <p className="text-center text-sm text-slate-500 mt-6">
            Already have an account?{' '}
            <Link href="/login" className="text-cyan-400 hover:text-cyan-300 font-medium transition-colors">Sign in</Link>
          </p>
        </div>
      </div>
    </div>
  )
}
