'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { motion } from 'framer-motion'
import {
  BookOpen, Clock, Award, ChevronRight, Shield,
  CheckCircle, ArrowLeft, Loader2, Sparkles, AlertCircle
} from 'lucide-react'
import { learn, type ModuleOut, ApiError } from '@/lib/api'
import toast from 'react-hot-toast'

const stagger = { hidden: {}, visible: { transition: { staggerChildren: 0.08 } } }
const fadeUp = {
  hidden: { opacity: 0, y: 16 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.4, ease: 'easeOut' } }
}

export default function LearnIndexPage() {
  const [modules, setModules] = useState<ModuleOut[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<string>('all')

  useEffect(() => {
    async function fetchModules() {
      try {
        const data = await learn.modules()
        setModules(data)
      } catch (err) {
        if (err instanceof ApiError) {
          toast.error(err.detail)
        } else {
          toast.error('Failed to load learning modules.')
        }
      } finally {
        setLoading(false)
      }
    }
    fetchModules()
  }, [])

  const filteredModules = filter === 'all'
    ? modules
    : modules.filter(m => m.career_path === filter)

  return (
    <div className="min-h-screen" style={{ backgroundColor: '#0a0f1e', color: '#f1f5f9' }}>
      <div className="fixed inset-0 bg-grid pointer-events-none opacity-50" aria-hidden />

      {/* Top Bar */}
      <header className="border-b border-white/5 glass sticky top-0 z-20">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link
              href="/dashboard"
              className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-white/5 transition-all flex items-center gap-1.5 text-sm"
            >
              <ArrowLeft className="w-4 h-4" /> Back to Dashboard
            </Link>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs px-3 py-1 rounded-full text-cyan-400 font-mono" style={{ background: 'rgba(6,182,212,0.1)', border: '1px solid rgba(6,182,212,0.2)' }}>
              SOC & AppSec Track
            </span>
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 sm:px-6 py-10" role="main">
        {/* Title Banner */}
        <div className="mb-8">
          <div className="flex items-center gap-2 text-cyan-400 text-sm font-semibold mb-2">
            <Sparkles className="w-4 h-4" /> Curriculum & Pathways
          </div>
          <h1 className="text-3xl font-extrabold text-white tracking-tight">
            Security Training Modules
          </h1>
          <p className="text-slate-400 text-sm mt-1 max-w-2xl">
            Step through authorized defensive engineering, packet analysis, incident response, and secure coding lessons with deterministic evaluations.
          </p>
        </div>

        {/* Filter Pills */}
        <div className="flex flex-wrap gap-2 mb-8">
          {[
            { id: 'all', label: 'All Domains' },
            { id: 'soc_analyst', label: 'SOC Analyst' },
            { id: 'app_security', label: 'Application Security' },
            { id: 'cloud_security', label: 'Cloud Security' },
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setFilter(tab.id)}
              className={`px-4 py-2 rounded-xl text-xs font-semibold transition-all ${
                filter === tab.id
                  ? 'text-white shadow-cyber'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-white/5'
              }`}
              style={
                filter === tab.id
                  ? { background: 'linear-gradient(135deg, #06b6d4, #7c3aed)' }
                  : { border: '1px solid rgba(255,255,255,0.08)' }
              }
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Loading / Content */}
        {loading ? (
          <div className="flex flex-col items-center justify-center py-20 text-slate-400 gap-3">
            <Loader2 className="w-6 h-6 animate-spin text-cyan-400" />
            <span className="text-sm">Fetching verified modules...</span>
          </div>
        ) : filteredModules.length === 0 ? (
          <div className="glass rounded-2xl p-10 text-center border border-white/10 max-w-md mx-auto">
            <AlertCircle className="w-10 h-10 text-slate-500 mx-auto mb-3" />
            <h3 className="text-base font-semibold text-white">No modules found</h3>
            <p className="text-xs text-slate-400 mt-1">
              Modules for this filter are currently being drafted. Check back shortly.
            </p>
          </div>
        ) : (
          <motion.div
            initial="hidden"
            animate="visible"
            variants={stagger}
            className="grid md:grid-cols-2 gap-6"
          >
            {filteredModules.map(mod => (
              <motion.div key={mod.id} variants={fadeUp}>
                <Link
                  href={`/dashboard/learn/${mod.slug}`}
                  className="glass rounded-2xl p-6 border border-white/10 hover:border-cyan-500/40 transition-all block group relative overflow-hidden"
                >
                  <div className="flex items-start justify-between mb-4">
                    <div
                      className="w-12 h-12 rounded-xl flex items-center justify-center"
                      style={{ background: 'rgba(6,182,212,0.1)', border: '1px solid rgba(6,182,212,0.2)' }}
                    >
                      <BookOpen className="w-6 h-6 text-cyan-400 group-hover:scale-105 transition-transform" />
                    </div>
                    <span
                      className="text-xs px-2.5 py-1 rounded-full font-medium capitalize"
                      style={{ background: 'rgba(124,58,237,0.15)', color: '#a78bfa', border: '1px solid rgba(124,58,237,0.2)' }}
                    >
                      {mod.difficulty}
                    </span>
                  </div>

                  <h2 className="text-lg font-bold text-white group-hover:text-cyan-400 transition-colors mb-2">
                    {mod.title}
                  </h2>
                  <p className="text-slate-400 text-xs leading-relaxed mb-6 line-clamp-2">
                    {mod.description}
                  </p>

                  <div className="flex items-center justify-between text-xs text-slate-400 pt-4 border-t border-white/5">
                    <div className="flex items-center gap-4">
                      <span className="flex items-center gap-1.5">
                        <BookOpen className="w-3.5 h-3.5 text-slate-500" />
                        {mod.lesson_count} {mod.lesson_count === 1 ? 'lesson' : 'lessons'}
                      </span>
                      <span className="flex items-center gap-1.5">
                        <Award className="w-3.5 h-3.5 text-amber-400" />
                        {mod.xp_reward} XP
                      </span>
                    </div>
                    <span className="text-cyan-400 font-medium flex items-center gap-1 group-hover:translate-x-1 transition-transform">
                      Start <ChevronRight className="w-3.5 h-3.5" />
                    </span>
                  </div>
                </Link>
              </motion.div>
            ))}
          </motion.div>
        )}
      </main>
    </div>
  )
}
