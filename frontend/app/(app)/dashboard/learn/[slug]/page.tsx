'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { motion, AnimatePresence } from 'framer-motion'
import {
  ArrowLeft, CheckCircle, Award, Terminal, HelpCircle,
  AlertTriangle, RotateCcw, ChevronRight, Lock, BookOpen,
  Loader2, Check, X
} from 'lucide-react'
import { learn, type LessonOut, type QuizOut, type AttemptResult, ApiError } from '@/lib/api'
import toast from 'react-hot-toast'

export default function ModuleDetailPage() {
  const params = useParams()
  const router = useRouter()
  const slug = params.slug as string

  const [lessons, setLessons] = useState<LessonOut[]>([])
  const [activeLessonIdx, setActiveLessonIdx] = useState(0)
  const [quiz, setQuiz] = useState<QuizOut | null>(null)
  const [activeTab, setActiveTab] = useState<'lesson' | 'quiz'>('lesson')
  const [loading, setLoading] = useState(true)

  // Quiz state
  const [selectedAnswers, setSelectedAnswers] = useState<Record<string, string>>({})
  const [submittingQuiz, setSubmittingQuiz] = useState(false)
  const [quizResult, setQuizResult] = useState<AttemptResult | null>(null)
  const [completingLesson, setCompletingLesson] = useState(false)

  useEffect(() => {
    async function loadModuleContent() {
      try {
        const lessonsData = await learn.lessons(slug)
        setLessons(lessonsData)

        // Find associated quiz if available
        // Usually matching quiz slug or fetched via quiz endpoint
        try {
          const quizData = await learn.quiz(slug.replace('-fundamentals', '-quiz').replace('defense', 'defense-quiz').replace('application', 'security-quiz'))
          setQuiz(quizData)
        } catch {
          // If named differently, try matching quiz slug
          try {
            const fallbackQuiz = await learn.quiz(slug + '-quiz')
            setQuiz(fallbackQuiz)
          } catch {
            // Quiz may not exist yet for this module
          }
        }
      } catch (err) {
        if (err instanceof ApiError) {
          toast.error(err.detail)
        } else {
          toast.error('Failed to load lesson content.')
        }
      } finally {
        setLoading(false)
      }
    }
    if (slug) {
      loadModuleContent()
    }
  }, [slug])

  const currentLesson = lessons[activeLessonIdx]

  const handleCompleteLesson = async () => {
    if (!currentLesson) return
    setCompletingLesson(true)
    try {
      const res = await learn.completeLesson(currentLesson.id)
      if (res.xp_awarded) {
        toast.success(`Lesson completed! +${res.xp_amount} XP earned! 🎉`)
      } else {
        toast.success('Lesson marked as reviewed.')
      }

      // Automatically advance to next lesson or quiz
      if (activeLessonIdx < lessons.length - 1) {
        setActiveLessonIdx(prev => prev + 1)
      } else if (quiz) {
        setActiveTab('quiz')
      }
    } catch (err) {
      if (err instanceof ApiError) {
        toast.error(err.detail)
      } else {
        toast.error('Failed to update progress.')
      }
    } finally {
      setCompletingLesson(false)
    }
  }

  const handleOptionSelect = (questionId: string, optionId: string) => {
    if (quizResult) return // Locked after submission until reset
    setSelectedAnswers(prev => ({
      ...prev,
      [questionId]: optionId
    }))
  }

  const handleSubmitQuiz = async () => {
    if (!quiz) return
    setSubmittingQuiz(true)
    try {
      const result = await learn.submitQuiz(quiz.id, selectedAnswers)
      setQuizResult(result)
      if (result.passed) {
        toast.success(`Quiz passed with ${result.score}%! ${result.xp_awarded ? `+${result.xp_amount} XP` : ''}`)
      } else {
        toast.error(`Score: ${result.score}%. Passing threshold is ${quiz.passing_score}%.`)
      }
    } catch (err) {
      if (err instanceof ApiError) {
        toast.error(err.detail)
      } else {
        toast.error('Failed to submit assessment.')
      }
    } finally {
      setSubmittingQuiz(false)
    }
  }

  const handleRetakeQuiz = () => {
    setSelectedAnswers({})
    setQuizResult(null)
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: '#0a0f1e' }}>
        <div className="flex flex-col items-center gap-3 text-slate-400">
          <Loader2 className="w-6 h-6 animate-spin text-cyan-400" />
          <span className="text-sm">Loading security scenario...</span>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex flex-col" style={{ backgroundColor: '#0a0f1e', color: '#f1f5f9' }}>
      {/* Top Navbar */}
      <header className="border-b border-white/5 glass sticky top-0 z-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-3.5 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link
              href="/dashboard/learn"
              className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-white/5 transition-all flex items-center gap-1.5 text-xs font-medium"
            >
              <ArrowLeft className="w-4 h-4" /> Curriculum
            </Link>
            <span className="text-slate-600">/</span>
            <span className="text-xs font-semibold text-white truncate max-w-xs sm:max-w-md">
              {currentLesson?.title ?? slug}
            </span>
          </div>

          <div className="flex items-center gap-3">
            <div className="flex bg-white/5 p-1 rounded-xl border border-white/5 text-xs">
              <button
                onClick={() => setActiveTab('lesson')}
                className={`px-3 py-1.5 rounded-lg font-medium transition-all ${
                  activeTab === 'lesson'
                    ? 'bg-cyan-500/20 text-cyan-400 border border-cyan-500/30'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                Lesson Content
              </button>
              {quiz && (
                <button
                  onClick={() => setActiveTab('quiz')}
                  className={`px-3 py-1.5 rounded-lg font-medium transition-all flex items-center gap-1.5 ${
                    activeTab === 'quiz'
                      ? 'bg-purple-500/20 text-purple-400 border border-purple-500/30'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  <Award className="w-3.5 h-3.5" />
                  Quiz Evaluation
                </button>
              )}
            </div>
          </div>
        </div>
      </header>

      {/* Main Container with Sidebar + Content */}
      <div className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 py-8 flex flex-col lg:flex-row gap-8">
        {/* Navigation Sidebar */}
        <aside className="w-full lg:w-72 flex-shrink-0 space-y-6">
          <div className="glass rounded-2xl p-5 border border-white/10">
            <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-4">
              Module Outline
            </h3>
            <div className="space-y-2">
              {lessons.map((les, idx) => (
                <button
                  key={les.id}
                  onClick={() => {
                    setActiveLessonIdx(idx)
                    setActiveTab('lesson')
                  }}
                  className={`w-full text-left p-3 rounded-xl text-xs transition-all flex items-start gap-3 ${
                    activeTab === 'lesson' && activeLessonIdx === idx
                      ? 'bg-cyan-500/15 border border-cyan-500/30 text-white font-semibold'
                      : 'text-slate-400 hover:bg-white/5 hover:text-slate-200 border border-transparent'
                  }`}
                >
                  <span className="w-5 h-5 rounded-md bg-white/5 flex items-center justify-center text-[10px] text-cyan-400 flex-shrink-0 mt-0.5">
                    {idx + 1}
                  </span>
                  <div className="flex-1 min-w-0">
                    <div className="truncate">{les.title}</div>
                    <div className="text-[10px] text-slate-500 mt-0.5">{les.estimated_minutes} mins · +{les.xp_reward} XP</div>
                  </div>
                </button>
              ))}

              {quiz && (
                <button
                  onClick={() => setActiveTab('quiz')}
                  className={`w-full text-left p-3 rounded-xl text-xs transition-all flex items-start gap-3 ${
                    activeTab === 'quiz'
                      ? 'bg-purple-500/15 border border-purple-500/30 text-white font-semibold'
                      : 'text-slate-400 hover:bg-white/5 hover:text-slate-200 border border-transparent'
                  }`}
                >
                  <span className="w-5 h-5 rounded-md bg-purple-500/20 flex items-center justify-center text-[10px] text-purple-400 flex-shrink-0 mt-0.5">
                    ★
                  </span>
                  <div className="flex-1 min-w-0">
                    <div className="truncate">{quiz.title}</div>
                    <div className="text-[10px] text-slate-500 mt-0.5">Evaluation · +{quiz.xp_reward} XP</div>
                  </div>
                </button>
              )}
            </div>
          </div>
        </aside>

        {/* Content Pane */}
        <main className="flex-1 min-w-0" role="main">
          {activeTab === 'lesson' && currentLesson && (
            <motion.div
              key={currentLesson.id}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              className="glass-strong rounded-2xl p-6 sm:p-10 border border-white/10"
            >
              <div className="flex items-center justify-between pb-6 mb-6 border-b border-white/5">
                <div>
                  <span className="text-xs text-cyan-400 font-mono">LESSON {activeLessonIdx + 1} OF {lessons.length}</span>
                  <h1 className="text-2xl font-extrabold text-white mt-1">{currentLesson.title}</h1>
                </div>
                <div className="text-xs px-3 py-1.5 rounded-full bg-amber-400/10 border border-amber-400/20 text-amber-400 font-medium flex items-center gap-1.5">
                  <Award className="w-3.5 h-3.5" /> +{currentLesson.xp_reward} XP
                </div>
              </div>

              {/* Lesson Body */}
              <div className="prose prose-invert max-w-none text-slate-300 text-sm leading-relaxed space-y-4">
                <div className="whitespace-pre-line font-sans">
                  {currentLesson.content_md}
                </div>
              </div>

              {/* Footer Actions */}
              <div className="mt-10 pt-6 border-t border-white/5 flex items-center justify-between">
                <span className="text-xs text-slate-500">
                  Read thoroughly before attempting assessment.
                </span>
                <button
                  onClick={handleCompleteLesson}
                  disabled={completingLesson}
                  className="px-6 py-2.5 rounded-xl font-semibold text-xs text-white transition-all shadow-cyber flex items-center gap-2 hover:opacity-90 disabled:opacity-50"
                  style={{ background: 'linear-gradient(135deg, #06b6d4, #7c3aed)' }}
                >
                  {completingLesson ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <CheckCircle className="w-4 h-4" />
                  )}
                  Complete & Next
                </button>
              </div>
            </motion.div>
          )}

          {activeTab === 'quiz' && quiz && (
            <motion.div
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              className="glass-strong rounded-2xl p-6 sm:p-10 border border-white/10"
            >
              <div className="pb-6 mb-6 border-b border-white/5">
                <div className="flex items-center justify-between">
                  <span className="text-xs text-purple-400 font-mono">DETERMINISTIC EVALUATION</span>
                  <span className="text-xs text-slate-400">Passing score: {quiz.passing_score}%</span>
                </div>
                <h1 className="text-2xl font-extrabold text-white mt-1">{quiz.title}</h1>
                <p className="text-xs text-slate-400 mt-1">{quiz.description}</p>
              </div>

              {/* Questions */}
              <div className="space-y-8">
                {quiz.questions.map((q, qIdx) => {
                  const selectedOpt = selectedAnswers[q.id]
                  const qFeedback = quizResult?.per_question.find(pq => pq.question_id === q.id)

                  return (
                    <div key={q.id} className="p-5 rounded-2xl border border-white/5 bg-white/[0.02]">
                      <div className="flex items-start justify-between gap-4 mb-4">
                        <h3 className="text-sm font-semibold text-white leading-snug">
                          <span className="text-cyan-400 mr-2 font-mono">Q{qIdx + 1}.</span>
                          {q.question_text}
                        </h3>
                        {qFeedback && (
                          <span className={`text-xs px-2.5 py-1 rounded-full font-semibold flex items-center gap-1 ${
                            qFeedback.correct ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' : 'bg-rose-500/10 text-rose-400 border border-rose-500/20'
                          }`}>
                            {qFeedback.correct ? <Check className="w-3.5 h-3.5" /> : <X className="w-3.5 h-3.5" />}
                            {qFeedback.correct ? 'Correct' : 'Incorrect'}
                          </span>
                        )}
                      </div>

                      <div className="space-y-2">
                        {q.options.map(opt => {
                          const isSelected = selectedOpt === opt.id
                          let style = { background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)', color: '#cbd5e1' }

                          if (isSelected) {
                            style = { background: 'rgba(6,182,212,0.1)', border: '1px solid rgba(6,182,212,0.4)', color: '#22d3ee' }
                          }

                          if (quizResult && qFeedback) {
                            if (opt.id === qFeedback.correct_option_id) {
                              style = { background: 'rgba(16,185,129,0.15)', border: '1px solid rgba(16,185,129,0.4)', color: '#34d399' }
                            } else if (isSelected && !qFeedback.correct) {
                              style = { background: 'rgba(244,63,94,0.15)', border: '1px solid rgba(244,63,94,0.4)', color: '#fb7185' }
                            }
                          }

                          return (
                            <button
                              key={opt.id}
                              onClick={() => handleOptionSelect(q.id, opt.id)}
                              disabled={!!quizResult}
                              className="w-full text-left p-3 rounded-xl text-xs transition-all flex items-center justify-between"
                              style={style}
                            >
                              <span>
                                <strong className="mr-2 uppercase font-mono">{opt.id}.</strong>
                                {opt.text}
                              </span>
                              {isSelected && !quizResult && (
                                <div className="w-2 h-2 rounded-full bg-cyan-400" />
                              )}
                            </button>
                          )
                        })}
                      </div>

                      {/* Explanation box after submission */}
                      {qFeedback && qFeedback.explanation && (
                        <div className="mt-3 p-3 rounded-xl bg-white/[0.04] border border-white/5 text-xs text-slate-300">
                          <strong className="text-cyan-400">Analysis: </strong> {qFeedback.explanation}
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>

              {/* Submission Results / Bottom Controls */}
              <div className="mt-10 pt-6 border-t border-white/5">
                {quizResult ? (
                  <div className="flex flex-col sm:flex-row items-center justify-between gap-4 p-5 rounded-2xl bg-white/[0.03] border border-white/10">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className={`text-lg font-bold ${quizResult.passed ? 'text-emerald-400' : 'text-rose-400'}`}>
                          {quizResult.passed ? 'Passed 🎉' : 'Needs Review'}
                        </span>
                        <span className="text-xs text-slate-400">({quizResult.score}% earned)</span>
                      </div>
                      <p className="text-xs text-slate-400 mt-1">
                        {quizResult.message}
                      </p>
                    </div>
                    <div className="flex items-center gap-3">
                      {!quizResult.passed && (
                        <button
                          onClick={handleRetakeQuiz}
                          className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-300 hover:text-white bg-white/5 border border-white/10 flex items-center gap-1.5 transition-all"
                        >
                          <RotateCcw className="w-3.5 h-3.5" /> Retake Quiz
                        </button>
                      )}
                      <Link
                        href="/dashboard"
                        className="px-5 py-2 rounded-xl text-xs font-semibold text-white shadow-cyber transition-all hover:opacity-90"
                        style={{ background: 'linear-gradient(135deg, #06b6d4, #7c3aed)' }}
                      >
                        Return to Dashboard
                      </Link>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-slate-500">
                      {Object.keys(selectedAnswers).length} of {quiz.questions.length} answered
                    </span>
                    <button
                      onClick={handleSubmitQuiz}
                      disabled={submittingQuiz || Object.keys(selectedAnswers).length < quiz.questions.length}
                      className="px-6 py-2.5 rounded-xl font-semibold text-xs text-white shadow-cyber transition-all hover:opacity-90 disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-2"
                      style={{ background: 'linear-gradient(135deg, #06b6d4, #7c3aed)' }}
                    >
                      {submittingQuiz ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <Award className="w-4 h-4" />
                      )}
                      Submit for Evaluation
                    </button>
                  </div>
                )}
              </div>
            </motion.div>
          )}
        </main>
      </div>
    </div>
  )
}
