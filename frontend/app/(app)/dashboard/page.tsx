'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { motion } from 'framer-motion'
import {
  Shield, Brain, BarChart3, BookOpen, Terminal,
  TrendingUp, Award, LogOut, User, ChevronRight,
  Zap, Target, CheckCircle, Lock, Loader2
} from 'lucide-react'
import Link from 'next/link'
import { auth, learn, type UserOut, type ModuleOut, type ProgressOut, ApiError } from '@/lib/api'
import toast from 'react-hot-toast'

const fadeUp = {
  hidden: { opacity: 0, y: 16 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.4, ease: 'easeOut' } },
}
const stagger = { hidden: {}, visible: { transition: { staggerChildren: 0.08 } } }

const domainLabels: Record<string, string> = {
  network_security: 'Network Security',
  web_security: 'Web Security',
  cryptography: 'Cryptography',
  incident_response: 'Incident Response',
  cloud_security: 'Cloud Security',
  malware_analysis: 'Malware Analysis',
}

function XPBar({ xp, level }: { xp: number; level: number }) {
  // Compute progress within current level
  const levelThreshold = (n: number) => 100 * n * (n - 1) / 2
  const currentLevelXP = levelThreshold(level)
  const nextLevelXP = levelThreshold(level + 1)
  const progress = nextLevelXP > currentLevelXP
    ? ((xp - currentLevelXP) / (nextLevelXP - currentLevelXP)) * 100
    : 100

  return (
    <div className="space-y-1">
      <div className="flex justify-between text-xs text-slate-400">
        <span>Level {level}</span>
        <span>{xp} XP · {Math.round(progress)}% to Level {level + 1}</span>
      </div>
      <div className="h-2 rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.08)' }}>
        <motion.div
          className="h-full rounded-full"
          style={{ background: 'linear-gradient(90deg,#06b6d4,#7c3aed)' }}
          initial={{ width: 0 }}
          animate={{ width: `${Math.min(progress, 100)}%` }}
          transition={{ duration: 0.8, ease: 'easeOut' }}
        />
      </div>
    </div>
  )
}

function SkillRadar({ scores }: { scores: Record<string, number> }) {
  const entries = Object.entries(scores).slice(0, 6)
  if (entries.length === 0) {
    return (
      <div className="text-center py-8 text-slate-500 text-sm">
        Complete your onboarding assessment to see skill scores.
      </div>
    )
  }
  return (
    <div className="space-y-3">
      {entries.map(([domain, score]) => (
        <div key={domain}>
          <div className="flex justify-between text-xs mb-1">
            <span className="text-slate-400">{domainLabels[domain] ?? domain}</span>
            <span className="text-white font-medium">{score}/100</span>
          </div>
          <div className="h-1.5 rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.08)' }}>
            <motion.div
              className="h-full rounded-full"
              style={{ background: score >= 70 ? '#10b981' : score >= 40 ? '#f59e0b' : '#f43f5e' }}
              initial={{ width: 0 }}
              animate={{ width: `${score}%` }}
              transition={{ duration: 0.6, ease: 'easeOut', delay: 0.1 }}
            />
          </div>
        </div>
      ))}
    </div>
  )
}

export default function DashboardPage() {
  const router = useRouter()
  const [user, setUser] = useState<UserOut | null>(null)
  const [modules, setModules] = useState<ModuleOut[]>([])
  const [progress, setProgress] = useState<ProgressOut | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function loadDashboard() {
      try {
        const [userData, modulesData, progressData] = await Promise.all([
          auth.me(),
          learn.modules(),
          learn.progress(),
        ])
        setUser(userData)
        setModules(modulesData)
        setProgress(progressData)

        // Redirect to onboarding if not completed
        if (!userData.onboarding_completed) {
          router.replace('/onboarding')
          return
        }
      } catch (err) {
        if (err instanceof ApiError && err.status === 401) {
          router.replace('/login')
        } else {
          toast.error('Failed to load dashboard.')
        }
      } finally {
        setLoading(false)
      }
    }
    loadDashboard()
  }, [router])

  const handleLogout = async () => {
    try {
      await auth.logout()
      router.push('/')
    } catch {
      toast.error('Logout failed.')
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: '#0a0f1e' }}>
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 rounded-xl flex items-center justify-center shadow-cyber" style={{ background: 'linear-gradient(135deg,#06b6d4,#7c3aed)' }}>
            <Shield className="w-6 h-6 text-white" />
          </div>
          <div className="flex items-center gap-2 text-slate-400 text-sm">
            <Loader2 className="w-4 h-4 animate-spin" /> Loading your dashboard…
          </div>
        </div>
      </div>
    )
  }

  if (!user) return null

  const completedCount = progress?.completed_lessons.length ?? 0
  const quizzesCount = Object.keys(progress?.quiz_best_scores ?? {}).length
  const passedQuizzes = Object.values(progress?.quiz_best_scores ?? {}).filter(s => s >= 70).length

  return (
    <div className="min-h-screen" style={{ backgroundColor: '#0a0f1e', color: '#f1f5f9' }}>
      <div className="fixed inset-0 bg-grid pointer-events-none opacity-50" aria-hidden />

      {/* ── Sidebar ── */}
      <aside className="fixed top-0 left-0 bottom-0 w-64 glass border-r border-white/5 flex flex-col hidden lg:flex" role="navigation" aria-label="Dashboard navigation">
        {/* Logo */}
        <div className="px-6 py-5 border-b border-white/5">
          <Link href="/" className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: 'linear-gradient(135deg,#06b6d4,#7c3aed)' }}>
              <Shield className="w-4 h-4 text-white" />
            </div>
            <span className="font-bold text-sm"><span className="text-gradient-cyber">Cyber</span><span className="text-white">Mentor AI</span></span>
          </Link>
        </div>

        {/* User card */}
        <div className="px-4 py-4 border-b border-white/5">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-9 h-9 rounded-full flex items-center justify-center text-white text-sm font-bold flex-shrink-0" style={{ background: 'linear-gradient(135deg,#06b6d4,#7c3aed)' }}>
              {user.full_name.charAt(0).toUpperCase()}
            </div>
            <div className="min-w-0">
              <div className="text-sm font-semibold text-white truncate">{user.full_name}</div>
              <div className="text-xs text-slate-500 truncate">{user.email}</div>
            </div>
          </div>
          <XPBar xp={user.xp_total} level={user.level} />
        </div>

        {/* Nav */}
        <nav className="flex-1 px-3 py-4 space-y-1">
          {[
            { href: '/dashboard', icon: BarChart3, label: 'Dashboard', active: true },
            { href: '/dashboard/learn', icon: BookOpen, label: 'Learn' },
            { href: '/dashboard/labs', icon: Terminal, label: 'Labs' },
            { href: '/dashboard/mentor', icon: Brain, label: 'AI Mentor' },
            { href: '/dashboard/progress', icon: TrendingUp, label: 'My Progress' },
            { href: '/dashboard/achievements', icon: Award, label: 'Achievements' },
          ].map(item => (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm transition-all ${
                item.active
                  ? 'text-cyan-400 font-medium'
                  : 'text-slate-400 hover:text-white hover:bg-white/5'
              }`}
              style={item.active ? { background: 'rgba(6,182,212,0.1)', border: '1px solid rgba(6,182,212,0.2)' } : {}}
              aria-current={item.active ? 'page' : undefined}
            >
              <item.icon className="w-4 h-4 flex-shrink-0" />
              {item.label}
            </Link>
          ))}
        </nav>

        {/* Logout */}
        <div className="px-3 py-4 border-t border-white/5">
          <button
            onClick={handleLogout}
            className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 transition-all w-full"
          >
            <LogOut className="w-4 h-4" /> Sign Out
          </button>
        </div>
      </aside>

      {/* ── Main content ── */}
      <main className="lg:ml-64 min-h-screen" role="main">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8">

          {/* Header */}
          <motion.div initial={{ opacity: 0, y: -12 }} animate={{ opacity: 1, y: 0 }} className="mb-8">
            <h1 className="text-2xl font-bold text-white">
              Welcome back, <span className="text-gradient-cyber">{user.full_name.split(' ')[0]}</span> 👋
            </h1>
            <p className="text-slate-400 text-sm mt-1">Continue your cybersecurity learning journey</p>
          </motion.div>

          {/* Stats row */}
          <motion.div initial="hidden" animate="visible" variants={stagger} className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
            {[
              { label: 'Total XP', value: user.xp_total.toLocaleString(), icon: Zap, color: 'text-amber-400', bg: 'bg-amber-400/10', border: 'border-amber-400/20' },
              { label: 'Current Level', value: `Level ${user.level}`, icon: Award, color: 'text-purple-400', bg: 'bg-purple-400/10', border: 'border-purple-400/20' },
              { label: 'Lessons Done', value: completedCount, icon: CheckCircle, color: 'text-emerald-400', bg: 'bg-emerald-400/10', border: 'border-emerald-400/20' },
              { label: 'Quizzes Passed', value: `${passedQuizzes}/${quizzesCount}`, icon: Target, color: 'text-cyan-400', bg: 'bg-cyan-400/10', border: 'border-cyan-400/20' },
            ].map(stat => (
              <motion.div key={stat.label} variants={fadeUp} className={`glass rounded-xl p-4 border ${stat.border}`}>
                <div className={`w-8 h-8 rounded-lg ${stat.bg} flex items-center justify-center mb-3`}>
                  <stat.icon className={`w-4 h-4 ${stat.color}`} />
                </div>
                <div className="text-2xl font-bold text-white">{stat.value}</div>
                <div className="text-xs text-slate-500 mt-0.5">{stat.label}</div>
              </motion.div>
            ))}
          </motion.div>

          <div className="grid lg:grid-cols-3 gap-6">
            {/* Modules / Continue Learning */}
            <motion.div initial="hidden" animate="visible" variants={stagger} className="lg:col-span-2">
              <div className="flex items-center justify-between mb-4">
                <h2 className="font-semibold text-white">Available Modules</h2>
                <Link href="/dashboard/learn" className="text-cyan-400 text-sm hover:text-cyan-300 transition-colors flex items-center gap-1">
                  View all <ChevronRight className="w-3.5 h-3.5" />
                </Link>
              </div>

              {modules.length === 0 ? (
                <div className="glass rounded-xl p-8 text-center border border-white/10">
                  <BookOpen className="w-8 h-8 text-slate-600 mx-auto mb-3" />
                  <p className="text-slate-400 text-sm">No modules available yet. Check back soon!</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {modules.slice(0, 4).map(mod => {
                    const isLocked = false // TODO: Implement prerequisite logic
                    return (
                      <motion.div key={mod.id} variants={fadeUp}>
                        <Link
                          href={`/dashboard/learn/${mod.slug}`}
                          className="glass rounded-xl p-4 border border-white/10 hover:border-cyan-500/30 transition-all flex items-center gap-4 group block"
                        >
                          <div className="w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0" style={{ background: 'rgba(6,182,212,0.1)', border: '1px solid rgba(6,182,212,0.2)' }}>
                            {isLocked ? <Lock className="w-4 h-4 text-slate-500" /> : <BookOpen className="w-4 h-4 text-cyan-400" />}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="text-sm font-semibold text-white group-hover:text-cyan-400 transition-colors truncate">{mod.title}</div>
                            <div className="text-xs text-slate-500 mt-0.5">{mod.lesson_count} lessons · {mod.xp_reward} XP · {mod.difficulty}</div>
                          </div>
                          <div className="flex items-center gap-2 flex-shrink-0">
                            <span className="text-xs px-2 py-1 rounded-full capitalize" style={{ background: 'rgba(124,58,237,0.15)', color: '#8b5cf6', border: '1px solid rgba(124,58,237,0.2)' }}>
                              {mod.career_path.replace('_', ' ')}
                            </span>
                            <ChevronRight className="w-4 h-4 text-slate-600 group-hover:text-cyan-400 transition-colors" />
                          </div>
                        </Link>
                      </motion.div>
                    )
                  })}
                </div>
              )}
            </motion.div>

            {/* Right column */}
            <div className="space-y-6">
              {/* Skill scores */}
              <motion.div initial={{ opacity: 0, x: 16 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.2 }} className="glass rounded-xl p-5 border border-white/10">
                <h2 className="font-semibold text-white mb-4 flex items-center gap-2">
                  <BarChart3 className="w-4 h-4 text-cyan-400" /> Skill Levels
                </h2>
                <SkillRadar scores={
                  // Use real domain scores from profile if available, else show placeholder
                  Object.keys(domainLabels).reduce((acc, k) => ({ ...acc, [k]: 0 }), {})
                } />
                {Object.values(domainLabels).every((_, i) => i === 0) && (
                  <Link href="/onboarding" className="mt-4 block text-center text-xs text-cyan-400 hover:text-cyan-300 transition-colors">
                    Complete assessment to populate scores →
                  </Link>
                )}
              </motion.div>

              {/* AI Mentor CTA */}
              <motion.div initial={{ opacity: 0, x: 16 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.3 }}>
                <Link href="/dashboard/mentor" className="glass-strong rounded-xl p-5 block group transition-all hover:border-purple-500/40" style={{ border: '1px solid rgba(124,58,237,0.2)' }}>
                  <div className="flex items-center gap-3 mb-3">
                    <div className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ background: 'rgba(124,58,237,0.15)', border: '1px solid rgba(124,58,237,0.3)' }}>
                      <Brain className="w-4 h-4 text-purple-400" />
                    </div>
                    <div>
                      <div className="text-sm font-semibold text-white">AI Mentor</div>
                      <div className="text-xs text-slate-500">Ask anything security-related</div>
                    </div>
                  </div>
                  <p className="text-slate-400 text-xs leading-relaxed">
                    Get personalized explanations, study tips, and concept clarifications. Mentor guides — never grades.
                  </p>
                  <div className="mt-3 text-purple-400 text-xs font-medium flex items-center gap-1 group-hover:gap-2 transition-all">
                    Open Mentor <ChevronRight className="w-3.5 h-3.5" />
                  </div>
                </Link>
              </motion.div>
            </div>
          </div>
        </div>
      </main>
    </div>
  )
}
