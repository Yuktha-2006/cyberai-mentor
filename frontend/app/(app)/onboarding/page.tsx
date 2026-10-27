'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import { Shield, ChevronRight, ChevronLeft, CheckCircle, Loader2 } from 'lucide-react'
import toast from 'react-hot-toast'

// The onboarding assessment — 10 questions across 5 domains.
// Scoring is deterministic on the backend.
// This page submits answers to /api/v1/onboarding/assessment.
const DOMAINS = ['network_security', 'web_security', 'incident_response', 'cryptography', 'cloud_security']

interface Question {
  id: string
  domain: string
  text: string
  options: { id: string; text: string }[]
}

// Seed questions (real content — not lorem ipsum)
const QUESTIONS: Question[] = [
  {
    id: 'q1', domain: 'network_security',
    text: 'Which port does HTTPS use by default?',
    options: [{ id: 'a', text: '80' }, { id: 'b', text: '443' }, { id: 'c', text: '8080' }, { id: 'd', text: '22' }],
  },
  {
    id: 'q2', domain: 'network_security',
    text: 'What does a stateful firewall track that a stateless one does not?',
    options: [{ id: 'a', text: 'MAC addresses' }, { id: 'b', text: 'Active connection state' }, { id: 'c', text: 'DNS queries' }, { id: 'd', text: 'User identity' }],
  },
  {
    id: 'q3', domain: 'web_security',
    text: 'Which OWASP Top 10 category covers SQL Injection?',
    options: [{ id: 'a', text: 'A01: Broken Access Control' }, { id: 'b', text: 'A03: Injection' }, { id: 'c', text: 'A05: Security Misconfiguration' }, { id: 'd', text: 'A07: Auth Failures' }],
  },
  {
    id: 'q4', domain: 'web_security',
    text: 'A website reflects user input directly into HTML without encoding. What attack is likely?',
    options: [{ id: 'a', text: 'CSRF' }, { id: 'b', text: 'Clickjacking' }, { id: 'c', text: 'XSS' }, { id: 'd', text: 'Path Traversal' }],
  },
  {
    id: 'q5', domain: 'incident_response',
    text: 'What is the first step in the NIST incident response lifecycle?',
    options: [{ id: 'a', text: 'Eradication' }, { id: 'b', text: 'Preparation' }, { id: 'c', text: 'Detection' }, { id: 'd', text: 'Containment' }],
  },
  {
    id: 'q6', domain: 'incident_response',
    text: 'An analyst sees 500 failed SSH logins from one IP in 60 seconds. What is the most likely attack?',
    options: [{ id: 'a', text: 'Phishing' }, { id: 'b', text: 'ARP Spoofing' }, { id: 'c', text: 'Brute force / credential stuffing' }, { id: 'd', text: 'DNS poisoning' }],
  },
  {
    id: 'q7', domain: 'cryptography',
    text: 'Which algorithm is considered quantum-resistant and is being standardized by NIST?',
    options: [{ id: 'a', text: 'RSA-4096' }, { id: 'b', text: 'CRYSTALS-Kyber' }, { id: 'c', text: 'AES-128' }, { id: 'd', text: 'DES' }],
  },
  {
    id: 'q8', domain: 'cryptography',
    text: 'What property ensures a message has not been tampered with in transit?',
    options: [{ id: 'a', text: 'Confidentiality' }, { id: 'b', text: 'Availability' }, { id: 'c', text: 'Integrity' }, { id: 'd', text: 'Non-repudiation' }],
  },
  {
    id: 'q9', domain: 'cloud_security',
    text: 'In AWS, what service controls who can access which AWS resources?',
    options: [{ id: 'a', text: 'CloudTrail' }, { id: 'b', text: 'IAM' }, { id: 'c', text: 'CloudFront' }, { id: 'd', text: 'GuardDuty' }],
  },
  {
    id: 'q10', domain: 'cloud_security',
    text: 'What does "least privilege" mean in cloud security?',
    options: [
      { id: 'a', text: 'Grant maximum permissions to avoid workflow blocks' },
      { id: 'b', text: 'Grant only the permissions needed for a specific task' },
      { id: 'c', text: 'Only admins get cloud access' },
      { id: 'd', text: 'Use shared credentials for efficiency' },
    ],
  },
]

const CAREER_PATHS = [
  { id: 'soc_analyst', label: 'SOC Analyst', desc: 'Monitor threats, investigate incidents' },
  { id: 'app_security', label: 'Application Security', desc: 'Secure software development' },
  { id: 'cloud_security', label: 'Cloud Security', desc: 'Protect cloud infrastructure' },
  { id: 'grc', label: 'GRC', desc: 'Governance, Risk, Compliance' },
]

const EXPERIENCE_LEVELS = [
  { id: 'beginner', label: 'Complete Beginner', desc: 'New to cybersecurity' },
  { id: 'intermediate', label: 'Some Experience', desc: 'Basic IT or security knowledge' },
  { id: 'advanced', label: 'Experienced', desc: 'Working in IT/Security already' },
]

type Step = 'career' | 'experience' | 'assessment' | 'submitting'

export default function OnboardingPage() {
  const router = useRouter()
  const [step, setStep] = useState<Step>('career')
  const [careerPath, setCareerPath] = useState('')
  const [experience, setExperience] = useState('')
  const [currentQ, setCurrentQ] = useState(0)
  const [answers, setAnswers] = useState<Record<string, string>>({})
  const [submitting, setSubmitting] = useState(false)

  const progress = step === 'career' ? 10 : step === 'experience' ? 30 : step === 'assessment'
    ? 30 + (currentQ / QUESTIONS.length) * 60
    : 100

  const handleAnswer = (qId: string, optId: string) => {
    setAnswers(prev => ({ ...prev, [qId]: optId }))
  }

  const handleNextQuestion = () => {
    if (currentQ < QUESTIONS.length - 1) {
      setCurrentQ(c => c + 1)
    } else {
      handleSubmit()
    }
  }

  const handleSubmit = async () => {
    setStep('submitting')
    setSubmitting(true)
    try {
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'
      const res = await fetch(`${apiUrl}/api/v1/onboarding/assessment`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          career_path: careerPath,
          experience_level: experience,
          answers,
        }),
      })

      if (!res.ok) {
        const data = await res.json()
        toast.error(data.detail || 'Submission failed.')
        setStep('assessment')
        return
      }

      router.push('/dashboard')
    } catch {
      toast.error('Network error. Please try again.')
      setStep('assessment')
    } finally {
      setSubmitting(false)
    }
  }

  const q = QUESTIONS[currentQ]
  const selectedAnswer = q ? answers[q.id] : undefined

  return (
    <div className="min-h-screen flex items-center justify-center px-4" style={{ backgroundColor: '#0a0f1e' }}>
      <div className="fixed inset-0 bg-grid pointer-events-none" aria-hidden />

      <div className="relative w-full max-w-lg">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="w-12 h-12 rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-cyber" style={{ background: 'linear-gradient(135deg,#06b6d4,#7c3aed)' }}>
            <Shield className="w-6 h-6 text-white" />
          </div>
          <h1 className="text-2xl font-bold text-white">Set Up Your Learning Profile</h1>
          <p className="text-slate-400 text-sm mt-1">Takes about 5 minutes — personalizes your entire experience</p>
        </div>

        {/* Progress bar */}
        <div className="mb-6">
          <div className="flex justify-between text-xs text-slate-500 mb-2">
            <span>{step === 'submitting' ? 'Setting up your profile…' : `Step ${step === 'career' ? 1 : step === 'experience' ? 2 : currentQ + 3} of ${QUESTIONS.length + 2}`}</span>
            <span>{Math.round(progress)}%</span>
          </div>
          <div className="h-1.5 rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.08)' }}>
            <motion.div
              className="h-full rounded-full"
              style={{ background: 'linear-gradient(90deg,#06b6d4,#7c3aed)' }}
              animate={{ width: `${progress}%` }}
              transition={{ duration: 0.4, ease: 'easeOut' }}
            />
          </div>
        </div>

        {/* Card */}
        <AnimatePresence mode="wait">
          {/* Career path selection */}
          {step === 'career' && (
            <motion.div key="career" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}
              className="glass-strong rounded-2xl p-8" style={{ border: '1px solid rgba(6,182,212,0.15)' }}>
              <h2 className="text-lg font-semibold text-white mb-2">What&apos;s your target role?</h2>
              <p className="text-slate-400 text-sm mb-6">We&apos;ll customize your learning path around this goal.</p>
              <div className="space-y-3">
                {CAREER_PATHS.map(cp => (
                  <button key={cp.id} onClick={() => setCareerPath(cp.id)}
                    className="w-full text-left p-4 rounded-xl transition-all"
                    style={careerPath === cp.id
                      ? { background: 'rgba(6,182,212,0.1)', border: '1px solid rgba(6,182,212,0.4)' }
                      : { background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}>
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="text-sm font-semibold text-white">{cp.label}</div>
                        <div className="text-xs text-slate-400 mt-0.5">{cp.desc}</div>
                      </div>
                      {careerPath === cp.id && <CheckCircle className="w-5 h-5 text-cyan-400 flex-shrink-0" />}
                    </div>
                  </button>
                ))}
              </div>
              <button disabled={!careerPath} onClick={() => setStep('experience')}
                className="w-full mt-6 flex items-center justify-center gap-2 py-3 px-6 rounded-xl font-semibold text-white transition-all disabled:opacity-40 disabled:cursor-not-allowed hover:opacity-90"
                style={{ background: 'linear-gradient(135deg,#06b6d4,#7c3aed)' }}>
                Continue <ChevronRight className="w-4 h-4" />
              </button>
            </motion.div>
          )}

          {/* Experience level */}
          {step === 'experience' && (
            <motion.div key="experience" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}
              className="glass-strong rounded-2xl p-8" style={{ border: '1px solid rgba(6,182,212,0.15)' }}>
              <h2 className="text-lg font-semibold text-white mb-2">What&apos;s your current experience level?</h2>
              <p className="text-slate-400 text-sm mb-6">Be honest — we&apos;ll verify with a short assessment.</p>
              <div className="space-y-3">
                {EXPERIENCE_LEVELS.map(el => (
                  <button key={el.id} onClick={() => setExperience(el.id)}
                    className="w-full text-left p-4 rounded-xl transition-all"
                    style={experience === el.id
                      ? { background: 'rgba(6,182,212,0.1)', border: '1px solid rgba(6,182,212,0.4)' }
                      : { background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}>
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="text-sm font-semibold text-white">{el.label}</div>
                        <div className="text-xs text-slate-400 mt-0.5">{el.desc}</div>
                      </div>
                      {experience === el.id && <CheckCircle className="w-5 h-5 text-cyan-400 flex-shrink-0" />}
                    </div>
                  </button>
                ))}
              </div>
              <div className="flex gap-3 mt-6">
                <button onClick={() => setStep('career')} className="flex items-center gap-1.5 px-4 py-3 rounded-xl text-slate-400 hover:text-white text-sm transition-colors" style={{ border: '1px solid rgba(255,255,255,0.08)' }}>
                  <ChevronLeft className="w-4 h-4" /> Back
                </button>
                <button disabled={!experience} onClick={() => setStep('assessment')}
                  className="flex-1 flex items-center justify-center gap-2 py-3 px-6 rounded-xl font-semibold text-white transition-all disabled:opacity-40 disabled:cursor-not-allowed hover:opacity-90"
                  style={{ background: 'linear-gradient(135deg,#06b6d4,#7c3aed)' }}>
                  Start Assessment <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </motion.div>
          )}

          {/* Assessment questions */}
          {step === 'assessment' && q && (
            <motion.div key={`q-${currentQ}`} initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}
              className="glass-strong rounded-2xl p-8" style={{ border: '1px solid rgba(6,182,212,0.15)' }}>
              <div className="flex items-center justify-between mb-6">
                <span className="text-xs font-medium px-2.5 py-1 rounded-full capitalize text-cyan-400" style={{ background: 'rgba(6,182,212,0.1)', border: '1px solid rgba(6,182,212,0.2)' }}>
                  {q.domain.replace('_', ' ')}
                </span>
                <span className="text-xs text-slate-500">{currentQ + 1} / {QUESTIONS.length}</span>
              </div>
              <h2 className="text-base font-semibold text-white mb-5 leading-relaxed">{q.text}</h2>
              <div className="space-y-3">
                {q.options.map(opt => (
                  <button key={opt.id} onClick={() => handleAnswer(q.id, opt.id)}
                    className="w-full text-left p-3.5 rounded-xl text-sm transition-all"
                    style={selectedAnswer === opt.id
                      ? { background: 'rgba(6,182,212,0.1)', border: '1px solid rgba(6,182,212,0.4)', color: '#22d3ee' }
                      : { background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', color: '#cbd5e1' }}>
                    <span className="font-medium mr-2">{opt.id.toUpperCase()}.</span>{opt.text}
                  </button>
                ))}
              </div>
              <div className="flex gap-3 mt-6">
                {currentQ > 0 && (
                  <button onClick={() => setCurrentQ(c => c - 1)} className="flex items-center gap-1.5 px-4 py-3 rounded-xl text-slate-400 hover:text-white text-sm transition-colors" style={{ border: '1px solid rgba(255,255,255,0.08)' }}>
                    <ChevronLeft className="w-4 h-4" /> Back
                  </button>
                )}
                <button disabled={!selectedAnswer} onClick={handleNextQuestion}
                  className="flex-1 flex items-center justify-center gap-2 py-3 px-6 rounded-xl font-semibold text-white transition-all disabled:opacity-40 disabled:cursor-not-allowed hover:opacity-90"
                  style={{ background: 'linear-gradient(135deg,#06b6d4,#7c3aed)' }}>
                  {currentQ < QUESTIONS.length - 1 ? <><span>Next</span><ChevronRight className="w-4 h-4" /></> : <><span>Finish Assessment</span><CheckCircle className="w-4 h-4" /></>}
                </button>
              </div>
            </motion.div>
          )}

          {/* Submitting state */}
          {step === 'submitting' && (
            <motion.div key="submitting" initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}
              className="glass-strong rounded-2xl p-12 text-center" style={{ border: '1px solid rgba(6,182,212,0.15)' }}>
              <Loader2 className="w-10 h-10 animate-spin text-cyan-400 mx-auto mb-4" />
              <p className="text-white font-semibold">Analyzing your assessment…</p>
              <p className="text-slate-400 text-sm mt-2">Building your personalized learning roadmap</p>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  )
}
