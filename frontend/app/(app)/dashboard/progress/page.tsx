'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { ArrowLeft, BookOpen, Award, Zap } from 'lucide-react'
import { learn, type ProgressOut, ApiError } from '@/lib/api'
import { useRouter } from 'next/navigation'

export default function ProgressPage() {
  const router = useRouter()
  const [progress, setProgress] = useState<ProgressOut | null>(null)

  useEffect(() => {
    learn.progress().then(setProgress).catch((error: unknown) => {
      if (error instanceof ApiError && error.status === 401) router.replace('/login')
    })
  }, [router])

  return (
    <main className="min-h-screen px-4 py-10" style={{ backgroundColor: '#0a0f1e', color: '#f1f5f9' }}>
      <div className="mx-auto max-w-4xl space-y-8">
        <Link href="/dashboard" className="inline-flex items-center gap-2 text-sm text-cyan-400 hover:text-cyan-300">
          <ArrowLeft className="h-4 w-4" /> Dashboard
        </Link>
        <div>
          <h1 className="text-3xl font-bold">My Progress</h1>
          <p className="mt-2 text-slate-400">Your learning activity and assessment results.</p>
        </div>
        {progress ? (
          <section className="grid gap-4 sm:grid-cols-3" aria-label="Learning progress summary">
            <div className="glass rounded-xl border border-white/10 p-5"><Zap className="mb-3 h-5 w-5 text-amber-400" /><p className="text-2xl font-bold">{progress.xp_total} XP</p><p className="text-sm text-slate-400">Level {progress.level}</p></div>
            <div className="glass rounded-xl border border-white/10 p-5"><BookOpen className="mb-3 h-5 w-5 text-cyan-400" /><p className="text-2xl font-bold">{progress.completed_lessons.length}</p><p className="text-sm text-slate-400">Lessons completed</p></div>
            <div className="glass rounded-xl border border-white/10 p-5"><Award className="mb-3 h-5 w-5 text-emerald-400" /><p className="text-2xl font-bold">{Object.keys(progress.quiz_best_scores).length}</p><p className="text-sm text-slate-400">Quizzes attempted</p></div>
          </section>
        ) : <p role="status" className="text-sm text-slate-400">Loading progress…</p>}
      </div>
    </main>
  )
}