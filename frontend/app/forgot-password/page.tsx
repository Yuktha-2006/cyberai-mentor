'use client'

import { useState } from 'react'
import Link from 'next/link'
import { ArrowLeft, Mail, Shield } from 'lucide-react'

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('')
  const [submitted, setSubmitted] = useState(false)

  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setSubmitted(true)
  }

  return (
    <main className="min-h-screen flex items-center justify-center px-4" style={{ backgroundColor: '#0a0f1e' }}>
      <div className="fixed inset-0 bg-grid pointer-events-none" aria-hidden="true" />
      <section className="relative w-full max-w-md">
        <div className="text-center mb-8">
          <Link href="/" className="inline-flex items-center justify-center w-10 h-10 rounded-xl mb-4" style={{ background: 'linear-gradient(135deg,#06b6d4,#7c3aed)' }} aria-label="CyberMentor AI home">
            <Shield className="w-5 h-5 text-white" />
          </Link>
          <h1 className="text-2xl font-bold text-white">Reset your password</h1>
          <p className="text-slate-400 text-sm mt-2">Enter the email address associated with your account.</p>
        </div>

        <div className="glass-strong rounded-2xl p-8" style={{ border: '1px solid rgba(6,182,212,0.15)' }}>
          {submitted ? (
            <p role="status" className="text-center text-sm text-emerald-300">
              If an account exists, a reset link has been sent.
            </p>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-5">
              <div>
                <label htmlFor="reset-email" className="block text-sm font-medium text-slate-300 mb-1.5">Email address</label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" aria-hidden="true" />
                  <input
                    id="reset-email"
                    type="email"
                    autoComplete="email"
                    required
                    value={email}
                    onChange={event => setEmail(event.target.value)}
                    placeholder="you@example.com"
                    className="w-full pl-10 pr-4 py-3 rounded-xl text-white placeholder-slate-600 text-sm focus:outline-none focus:ring-2 focus:ring-cyan-400"
                    style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)' }}
                  />
                </div>
              </div>
              <button
                type="submit"
                className="w-full py-3 px-6 rounded-xl font-semibold text-white transition-opacity hover:opacity-90 focus-visible-ring"
                style={{ background: 'linear-gradient(135deg,#06b6d4,#7c3aed)' }}
              >
                Send Reset Link
              </button>
            </form>
          )}

          <Link href="/login" className="mt-6 flex items-center justify-center gap-2 text-sm text-cyan-400 hover:text-cyan-300">
            <ArrowLeft className="w-4 h-4" /> Back to Sign In
          </Link>
        </div>
      </section>
    </main>
  )
}