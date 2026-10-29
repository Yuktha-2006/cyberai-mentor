'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { ArrowLeft, Award, BookOpen, Trophy } from 'lucide-react'
import { learn, type ProgressOut, ApiError } from '@/lib/api'
import { useRouter } from 'next/navigation'

export default function AchievementsPage() {
  const router = useRouter()
  const [progress, setProgress] = useState<ProgressOut | null>(null)

  useEffect(() => {
    learn.progress().then(setProgress).catch((error: unknown) => {
      if (error instanceof ApiError && error.status === 401) router.replace('/login')
    })
  }, [router])

  const hasPassedQuiz = Object.values(progress?.quiz_best_scores ?? {}).some(score => score >= 70)
  const achievements = [
    { title: 'First Steps', detail: 'Complete your first learning lesson.', earned: (progress?.completed_lessons.length ?? 0) > 0, icon: BookOpen },
    { title: 'Assessment Achiever', detail: 'Pass a quiz with a score of 70% or higher.', earned: hasPassedQuiz, icon: Award },
    { title: 'Rising Defender', detail: 'Reach learner level 2.', earned: (progress?.level ?? 1) >= 2, icon: Trophy },
  ]

  return (
    <main className="min-h-screen px-4 py-10" style={{ backgroundColor: '#0a0f1e', color: '#f1f5f9' }}>
      <div className="mx-auto max-w-4xl space-y-8">
        <Link href="/dashboard" className="inline-flex items-center gap-2 text-sm text-cyan-400 hover:text-cyan-300">
          <ArrowLeft className="h-4 w-4" /> Dashboard
        </Link>
        <div>
          <h1 className="text-3xl font-bold">Achievements</h1>
          <p className="mt-2 text-slate-400">Milestones earned through your learning activity.</p>
        </div>
        {progress ? (
          <ul className="space-y-3" aria-label="Achievements">
            {achievements.map(({ title, detail, earned, icon: Icon }) => (
              <li key={title} className="flex items-center gap-4 rounded-xl border border-white/10 p-5">
                <Icon className={`h-6 w-6 ${earned ? 'text-amber-400' : 'text-slate-600'}`} />
                <div><h2 className="font-semibold">{title}</h2><p className="text-sm text-slate-400">{detail}</p></div>
                <span className="ml-auto text-xs text-slate-400">{earned ? 'Earned' : 'In progress'}</span>
              </li>
            ))}
          </ul>
        ) : <p role="status" className="text-sm text-slate-400">Loading achievements…</p>}
      </div>
    </main>
  )
}