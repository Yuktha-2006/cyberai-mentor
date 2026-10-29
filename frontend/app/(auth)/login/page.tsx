'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Shield, Eye, EyeOff, ArrowRight, Loader2 } from 'lucide-react'
import toast from 'react-hot-toast'
import { z } from 'zod'

const schema = z.object({
  email: z.string().email('Enter a valid email address'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
})

export default function LoginPage() {
  const router = useRouter()
  const [form, setForm] = useState({ email: '', password: '' })
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [showPw, setShowPw] = useState(false)
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setErrors({})

    const result = schema.safeParse(form)
    if (!result.success) {
      const fieldErrors: Record<string, string> = {}
      result.error.issues.forEach(err => {
        if (err.path[0]) fieldErrors[err.path[0] as string] = err.message
      })
      setErrors(fieldErrors)
      return
    }

    setLoading(true)
    try {
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'
      const res = await fetch(`${apiUrl}/api/v1/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ email: form.email, password: form.password }),
      })

      const data = await res.json()

      if (!res.ok) {
        toast.error(data.detail || 'Login failed. Check your credentials.')
        return
      }

      toast.success('Welcome back!')
      router.push('/dashboard')
    } catch {
      toast.error('Network error. Is the server running?')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4" style={{ backgroundColor: '#0a0f1e' }}>
      <div className="fixed inset-0 bg-grid pointer-events-none" aria-hidden />

      <div className="relative w-full max-w-md">
        {/* Logo */}
        <div className="text-center mb-8">
          <Link href="/" className="inline-flex items-center gap-2 mb-4">
            <div className="w-10 h-10 rounded-xl flex items-center justify-center shadow-cyber" style={{ background: 'linear-gradient(135deg,#06b6d4,#7c3aed)' }}>
              <Shield className="w-5 h-5 text-white" />
            </div>
          </Link>
          <h1 className="text-2xl font-bold text-white">Welcome back</h1>
          <p className="text-slate-400 text-sm mt-1">Sign in to continue your learning journey</p>
        </div>

        {/* Card */}
        <div className="glass-strong rounded-2xl p-8" style={{ border: '1px solid rgba(6,182,212,0.15)' }}>
          <form onSubmit={handleSubmit} noValidate className="space-y-5">
            {/* Email */}
            <div>
              <label htmlFor="login-email" className="block text-sm font-medium text-slate-300 mb-1.5">Email address</label>
              <input
                id="login-email"
                type="email"
                autoComplete="email"
                value={form.email}
                onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
                placeholder="you@example.com"
                aria-invalid={!!errors.email}
                aria-describedby={errors.email ? 'login-email-error' : undefined}
                className="w-full px-4 py-3 rounded-xl text-white placeholder-slate-600 text-sm focus:outline-none focus:ring-2 focus:ring-cyan-400 transition-all"
                style={{ background: 'rgba(255,255,255,0.05)', border: errors.email ? '1px solid rgba(244,63,94,0.6)' : '1px solid rgba(255,255,255,0.1)' }}
              />
              {errors.email && <p id="login-email-error" className="text-rose-400 text-xs mt-1" role="alert">{errors.email}</p>}
            </div>

            {/* Password */}
            <div>
              <div className="flex justify-between mb-1.5">
                <label htmlFor="login-password" className="block text-sm font-medium text-slate-300">Password</label>
                <Link href="/forgot-password" className="text-xs text-cyan-400 hover:text-cyan-300 transition-colors">Forgot password?</Link>
              </div>
              <div className="relative">
                <input
                  id="login-password"
                  type={showPw ? 'text' : 'password'}
                  autoComplete="current-password"
                  value={form.password}
                  onChange={e => setForm(f => ({ ...f, password: e.target.value }))}
                  placeholder="••••••••"
                  aria-invalid={!!errors.password}
                  aria-describedby={errors.password ? 'login-pw-error' : undefined}
                  className="w-full px-4 py-3 pr-11 rounded-xl text-white placeholder-slate-600 text-sm focus:outline-none focus:ring-2 focus:ring-cyan-400 transition-all"
                  style={{ background: 'rgba(255,255,255,0.05)', border: errors.password ? '1px solid rgba(244,63,94,0.6)' : '1px solid rgba(255,255,255,0.1)' }}
                />
                <button type="button" onClick={() => setShowPw(!showPw)} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300 transition-colors" aria-label={showPw ? 'Hide password' : 'Show password'}>
                  {showPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
              {errors.password && <p id="login-pw-error" className="text-rose-400 text-xs mt-1" role="alert">{errors.password}</p>}
            </div>

            {/* Submit */}
            <button
              type="submit"
              id="login-submit"
              disabled={loading}
              className="w-full flex items-center justify-center gap-2 py-3 px-6 rounded-xl font-semibold text-white transition-all hover:opacity-90 disabled:opacity-60 disabled:cursor-not-allowed focus-visible-ring"
              style={{ background: 'linear-gradient(135deg,#06b6d4,#7c3aed)' }}
            >
              {loading ? <><Loader2 className="w-4 h-4 animate-spin" /> Signing in…</> : <>Sign In <ArrowRight className="w-4 h-4" /></>}
            </button>
          </form>

          <p className="text-center text-sm text-slate-500 mt-6">
            Don&apos;t have an account?{' '}
            <Link href="/register" className="text-cyan-400 hover:text-cyan-300 font-medium transition-colors">Create one free</Link>
          </p>
        </div>
      </div>
    </div>
  )
}
