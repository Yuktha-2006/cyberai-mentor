'use client'

import { useState, useRef } from 'react'
import { motion, useInView } from 'framer-motion'
import Link from 'next/link'
import {
  Shield, Brain, BarChart3, Target, Users, Zap, ChevronRight,
  ArrowRight, Terminal, Eye, TrendingUp, Award, Code2, Cloud,
  BookOpen, CheckCircle, Star, Globe, Menu, X,
} from 'lucide-react'

/* ── Animation variants ── */
const fadeUp = {
  hidden: { opacity: 0, y: 28 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.55, ease: 'easeOut' } },
}
const stagger = { hidden: {}, visible: { transition: { staggerChildren: 0.12 } } }

function Section({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  const ref = useRef(null)
  const inView = useInView(ref, { once: true, margin: '-80px' })
  return (
    <motion.div ref={ref} initial="hidden" animate={inView ? 'visible' : 'hidden'} variants={stagger} className={className}>
      {children}
    </motion.div>
  )
}

/* ── Data ── */
const features = [
  { icon: Brain, title: 'AI Mentor', desc: 'Context-aware instructor that adapts to your skill level, asks diagnostic questions, and suggests precise next steps — never grants grades.', color: 'text-cyan-400', bg: 'bg-cyan-400/10', border: 'border-cyan-400/20' },
  { icon: Terminal, title: 'Cyber Range Labs', desc: 'Phishing analysis, incident investigation, vulnerability triage, firewall config — all safely isolated with synthetic data.', color: 'text-purple-400', bg: 'bg-purple-400/10', border: 'border-purple-400/20' },
  { icon: TrendingUp, title: 'Adaptive Learning', desc: 'Rules-based engine detects gaps, schedules revision, and explains every recommendation with your actual performance data.', color: 'text-emerald-400', bg: 'bg-emerald-400/10', border: 'border-emerald-400/20' },
  { icon: BarChart3, title: 'Skill Analytics', desc: 'Track confidence vs. accuracy across 12 security domains. Spot weaknesses before they surface in certifications or interviews.', color: 'text-amber-400', bg: 'bg-amber-400/10', border: 'border-amber-400/20' },
  { icon: Award, title: 'Career Pathways', desc: 'Structured roadmaps for SOC Analyst, Application Security, Cloud Security, and GRC — with certification prep built in.', color: 'text-rose-400', bg: 'bg-rose-400/10', border: 'border-rose-400/20' },
  { icon: Shield, title: 'Safe by Design', desc: 'No real targets, no arbitrary commands. All labs use isolated, authorized synthetic environments.', color: 'text-teal-400', bg: 'bg-teal-400/10', border: 'border-teal-400/20' },
]

const careers = [
  { title: 'SOC Analyst', level: 'Entry → Mid', icon: Eye, tags: ['SIEM', 'Threat Detection', 'Incident Response', 'Log Analysis'], from: 'from-cyan-500/20', to: 'to-blue-500/20', border: 'border-cyan-500/30', accent: 'text-cyan-400' },
  { title: 'Application Security', level: 'Mid → Senior', icon: Code2, tags: ['OWASP Top 10', 'SAST/DAST', 'Secure Code Review', 'Threat Modeling'], from: 'from-purple-500/20', to: 'to-pink-500/20', border: 'border-purple-500/30', accent: 'text-purple-400' },
  { title: 'Cloud Security', level: 'Mid → Senior', icon: Cloud, tags: ['AWS Security', 'IAM', 'Zero Trust', 'Container Security'], from: 'from-emerald-500/20', to: 'to-teal-500/20', border: 'border-emerald-500/30', accent: 'text-emerald-400' },
  { title: 'GRC', level: 'Any Level', icon: BookOpen, tags: ['ISO 27001', 'GDPR', 'Risk Assessment', 'Compliance Frameworks'], from: 'from-amber-500/20', to: 'to-orange-500/20', border: 'border-amber-500/30', accent: 'text-amber-400' },
]

const steps = [
  { n: '01', title: 'Assess', desc: 'Onboarding quiz maps knowledge across 12 security domains' },
  { n: '02', title: 'Learn', desc: 'Structured modules with AI explanations tailored to your level' },
  { n: '03', title: 'Practice', desc: 'Hands-on labs in a safe cyber range with deterministic scoring' },
  { n: '04', title: 'Evaluate', desc: 'AI mentor reviews gaps, explains weaknesses, suggests next steps' },
  { n: '05', title: 'Advance', desc: 'Unlock harder content, earn XP, build your security portfolio' },
]

const testimonials = [
  { name: 'Priya Sharma', role: 'Junior SOC Analyst', co: 'TechCorp India', body: 'CyberMentor AI helped me go from zero knowledge to landing my first SOC role in 6 months. The labs feel like real investigations.', av: 'PS' },
  { name: 'Marcus Chen', role: 'CS Graduate', co: 'University of Toronto', body: 'The adaptive learning actually works — it caught that I was weak on log analysis before my interview. Got the job.', av: 'MC' },
  { name: 'Aisha Okonkwo', role: 'IT Manager → AppSec Engineer', co: 'FinTech Startup', body: 'The Application Security pathway was exactly what I needed for my transition. Clear, structured, and practical.', av: 'AO' },
]

const footerGroups = [
  {
    title: 'Product',
    links: [
      { label: 'Features', href: '#features' },
      { label: 'Career Paths', href: '#careers' },
      { label: 'Labs', href: '#labs' },
      { label: 'Pricing', href: '#pricing' },
    ],
  },
  {
    title: 'Project',
    links: [
      { label: 'About', href: '#journey-h2' },
      { label: 'Source Code', href: 'https://github.com/Yuktha-2006/cyberai-mentor' },
      { label: 'Security Model', href: 'https://github.com/Yuktha-2006/cyberai-mentor/blob/main/THREAT_MODEL.md' },
    ],
  },
  {
    title: 'Legal',
    links: [
      { label: 'Privacy Policy', href: '/privacy' },
      { label: 'Terms of Service', href: '/terms' },
      { label: 'Forgot Password', href: '/forgot-password' },
    ],
  },
]

export default function LandingPage() {
  const [open, setOpen] = useState(false)
  const [previewAction, setPreviewAction] = useState('')
  const [phishingAnswer, setPhishingAnswer] = useState('')

  return (
    <div className="min-h-screen overflow-x-hidden" style={{ backgroundColor: '#0a0f1e', color: '#f1f5f9' }}>
      {/* Grid background */}
      <div className="fixed inset-0 bg-grid pointer-events-none" aria-hidden />
      <div className="fixed inset-0 pointer-events-none" style={{ background: 'linear-gradient(180deg,#0a0f1e 0%,transparent 30%,transparent 70%,#0a0f1e 100%)' }} aria-hidden />

      {/* ── Navbar ── */}
      <nav className="fixed top-0 inset-x-0 z-50 glass border-b border-white/5" role="navigation" aria-label="Main navigation">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex items-center justify-between h-16">
          <Link href="/" className="flex items-center gap-2 focus-visible-ring rounded-lg" aria-label="CyberMentor AI home">
            <div className="w-8 h-8 rounded-lg flex items-center justify-center shadow-cyber" style={{ background: 'linear-gradient(135deg,#06b6d4,#7c3aed)' }}>
              <Shield className="w-4 h-4 text-white" />
            </div>
            <span className="font-bold text-lg"><span className="text-gradient-cyber">Cyber</span><span className="text-white">Mentor AI</span></span>
          </Link>

          <div className="hidden md:flex items-center gap-8">
            {[['#features','Features'],['#careers','Career Paths'],['#labs','Labs'],['#pricing','Pricing']].map(([href,label])=>(
              <a key={label} href={href} className="text-slate-400 hover:text-cyan-400 transition-colors text-sm font-medium">{label}</a>
            ))}
          </div>

          <div className="hidden md:flex items-center gap-3">
            <Link href="/login" className="text-slate-300 hover:text-white text-sm font-medium px-4 py-2 rounded-lg hover:bg-white/5 transition-colors focus-visible-ring">Sign In</Link>
            <Link href="/register" id="nav-cta" className="text-sm font-semibold px-5 py-2 rounded-lg text-white transition-all shadow-cyber hover:opacity-90 focus-visible-ring" style={{ background: 'linear-gradient(135deg,#06b6d4,#7c3aed)' }}>Get Started Free</Link>
          </div>

          <button className="md:hidden p-2 rounded-lg hover:bg-white/10 transition-colors focus-visible-ring" onClick={() => setOpen(!open)} aria-label={open ? 'Close menu' : 'Open menu'} aria-expanded={open}>
            {open ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </div>

        {open && (
          <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} className="md:hidden glass border-t border-white/5 px-4 py-4 flex flex-col gap-3">
            {[['#features','Features'],['#careers','Career Paths'],['#labs','Labs']].map(([href,label])=>(
              <a key={label} href={href} className="text-slate-300 hover:text-cyan-400 py-2 transition-colors" onClick={() => setOpen(false)}>{label}</a>
            ))}
            <Link href="/login" className="text-slate-300 py-2" onClick={() => setOpen(false)}>Sign In</Link>
            <Link href="/register" className="text-center py-3 rounded-lg text-white font-semibold" style={{ background: 'linear-gradient(135deg,#06b6d4,#7c3aed)' }} onClick={() => setOpen(false)}>Get Started Free</Link>
          </motion.div>
        )}
      </nav>

      {/* ── Hero ── */}
      <section className="relative min-h-screen flex items-center pt-16" aria-labelledby="hero-h1">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-24">
          <div className="grid lg:grid-cols-2 gap-16 items-center">
            {/* Left */}
            <motion.div initial={{ opacity: 0, x: -36 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.75, ease: 'easeOut' }} className="space-y-8">
              <div className="inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-medium text-cyan-400" style={{ background: 'rgba(6,182,212,0.1)', border: '1px solid rgba(6,182,212,0.3)' }}>
                <Zap className="w-4 h-4" /> AI-Powered Cybersecurity Education
              </div>
              <h1 id="hero-h1" className="text-4xl sm:text-5xl lg:text-6xl font-bold leading-tight">
                Master <span className="text-gradient-cyber">Cybersecurity</span> with Your <span className="text-gradient-teal">AI Mentor</span>
              </h1>
              <p className="text-lg text-slate-400 leading-relaxed max-w-lg">
                Personalized learning paths, hands-on cyber range labs, and an AI instructor that adapts to your skill level. From beginner to SOC analyst, cloud security engineer, or GRC professional.
              </p>
              <div className="flex flex-col sm:flex-row gap-4">
                <Link href="/register" id="hero-primary-cta" className="group flex items-center justify-center gap-2 font-semibold px-8 py-4 rounded-xl text-white transition-all shadow-cyber hover:opacity-90 focus-visible-ring" style={{ background: 'linear-gradient(135deg,#06b6d4,#7c3aed)' }}>
                  Start Learning Free <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
                </Link>
                <a href="#labs" id="hero-secondary-cta" className="flex items-center justify-center gap-2 glass font-semibold px-8 py-4 rounded-xl text-slate-300 hover:text-white transition-all focus-visible-ring" style={{ border: '1px solid rgba(255,255,255,0.1)' }}>
                  <Terminal className="w-5 h-5" /> See the Labs
                </a>
              </div>
              <div className="flex flex-wrap items-center gap-6 text-sm text-slate-500">
                {['Free to start', 'No credit card', 'Real-world labs'].map(t => (
                  <span key={t} className="flex items-center gap-1.5"><CheckCircle className="w-4 h-4 text-emerald-500" />{t}</span>
                ))}
              </div>
            </motion.div>

            {/* Right — live-looking lab card */}
            <motion.div initial={{ opacity: 0, x: 36 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.75, ease: 'easeOut', delay: 0.15 }} className="relative">
              <div className="glass-strong rounded-2xl p-6 shadow-cyber-strong" style={{ border: '1px solid rgba(6,182,212,0.2)' }}>
                <div className="flex items-center gap-2 mb-4 pb-4" style={{ borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
                  <div className="w-3 h-3 rounded-full bg-rose-500" />
                  <div className="w-3 h-3 rounded-full bg-amber-500" />
                  <div className="w-3 h-3 rounded-full bg-emerald-500" />
                  <span className="ml-2 text-xs text-slate-500 font-mono">cybermentor ~ incident-lab-01</span>
                </div>
                <div className="space-y-3 font-mono text-sm">
                  <div className="text-cyan-400">🔍 Analyzing authentication log...</div>
                  <div className="text-slate-400 pl-4">• 847 login attempts from <span className="text-amber-400">192.168.4.12</span></div>
                  <div className="text-slate-400 pl-4">• Spike at <span className="text-rose-400">02:34 UTC</span> — 340 req/min</div>
                  <div className="text-slate-400 pl-4">• Target: <span className="text-white">admin@corp.local</span></div>
                  <div className="text-emerald-400 mt-1">✓ Credential stuffing pattern identified</div>
                  <div className="mt-3 p-3 rounded-lg text-xs" style={{ background: 'rgba(124,58,237,0.1)', border: '1px solid rgba(124,58,237,0.3)' }}>
                    <div className="text-purple-400 font-semibold mb-1">🤖 AI Mentor</div>
                    <div className="text-slate-300 leading-relaxed">Good analysis. What immediate mitigation would you apply? Consider rate limiting and account lockout thresholds.</div>
                  </div>
                  <div className="flex gap-2 pt-1">
                    {['Block IP','Notify Admin','View Logs'].map((a,i) => (
                      <button
                        key={a}
                        type="button"
                        onClick={() => setPreviewAction(a)}
                        aria-pressed={previewAction === a}
                        className={`px-3 py-1.5 rounded-lg text-xs transition-colors ${i===0 ? 'text-cyan-400' : 'text-slate-400 hover:bg-white/10'}`}
                        style={i===0 ? { background:'rgba(6,182,212,0.15)', border:'1px solid rgba(6,182,212,0.3)' } : { background:'rgba(255,255,255,0.04)', border:'1px solid rgba(255,255,255,0.08)' }}
                      >
                        {a}
                      </button>
                    ))}
                  </div>
                  {previewAction && <p role="status" className="text-xs text-cyan-300">Demo action selected: {previewAction}</p>}
                </div>
                <div className="absolute -top-3 -right-3 rounded-full px-3 py-1.5 text-xs font-bold text-white shadow-lg" style={{ background: 'linear-gradient(135deg,#f59e0b,#ea580c)' }}>+50 XP</div>
              </div>

              {/* Floating badges */}
              <motion.div animate={{ y: [0,-8,0] }} transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut' }} className="absolute -left-6 top-1/4 glass rounded-xl p-3 shadow-lg hidden lg:block" style={{ border: '1px solid rgba(16,185,129,0.3)' }}>
                <div className="flex items-center gap-2"><Shield className="w-4 h-4 text-emerald-400" /><span className="text-xs font-medium text-emerald-400">Threat Analysis</span></div>
                <div className="mt-1 text-lg font-bold text-white">87<span className="text-xs text-slate-400">/100</span></div>
              </motion.div>
              <motion.div animate={{ y: [0,8,0] }} transition={{ duration: 4, repeat: Infinity, ease: 'easeInOut', delay: 1 }} className="absolute -right-6 bottom-1/4 glass rounded-xl p-3 shadow-lg hidden lg:block" style={{ border: '1px solid rgba(124,58,237,0.3)' }}>
                <div className="flex items-center gap-2"><TrendingUp className="w-4 h-4 text-purple-400" /><span className="text-xs font-medium text-purple-400">Level Progress</span></div>
                <div className="mt-1 text-lg font-bold text-white">Level 4</div>
              </motion.div>
            </motion.div>
          </div>
        </div>
      </section>

      {/* ── Stats bar ── */}
      <section aria-label="Platform statistics" style={{ borderTop: '1px solid rgba(255,255,255,0.05)', borderBottom: '1px solid rgba(255,255,255,0.05)', background: 'rgba(13,18,36,0.5)' }}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 grid grid-cols-2 lg:grid-cols-4 gap-8">
          {[['10,000+','Active Learners',Users],['50+','Hands-on Labs',Terminal],['8','Career Pathways',Target],['AI','Powered Mentor',Brain]].map(([v,l,Icon])=>(
            <div key={l as string} className="flex items-center gap-4">
              <div className="w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0" style={{ background:'rgba(6,182,212,0.1)', border:'1px solid rgba(6,182,212,0.2)' }}>
                {Icon && typeof Icon !== 'string' && <Icon className="w-5 h-5 text-cyan-400" />}
              </div>
              <div><div className="text-xl font-bold text-white">{v as string}</div><div className="text-sm text-slate-500">{l as string}</div></div>
            </div>
          ))}
        </div>
      </section>

      {/* ── Learning Journey ── */}
      <section className="py-24" aria-labelledby="journey-h2">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <Section className="text-center mb-16">
            <motion.h2 id="journey-h2" variants={fadeUp} className="text-3xl sm:text-4xl font-bold mb-4">Your Learning <span className="text-gradient-cyber">Journey</span></motion.h2>
            <motion.p variants={fadeUp} className="text-slate-400 text-lg max-w-2xl mx-auto">A structured, proven cycle — from initial assessment to career-ready mastery — with AI guidance at every step.</motion.p>
          </Section>
          <Section className="relative grid grid-cols-1 sm:grid-cols-3 lg:grid-cols-5 gap-6">
            {steps.map((s, i) => (
              <motion.div key={s.n} variants={fadeUp} className="relative">
                <div className="glass rounded-xl p-6 text-center group hover:border-cyan-500/30 transition-all" style={{ border: '1px solid rgba(255,255,255,0.08)' }}>
                  <div className="w-10 h-10 rounded-full flex items-center justify-center mx-auto mb-4 text-white font-bold text-sm" style={{ background: 'linear-gradient(135deg,#06b6d4,#7c3aed)' }}>{s.n}</div>
                  <h3 className="font-semibold text-white mb-2">{s.title}</h3>
                  <p className="text-slate-400 text-sm leading-relaxed">{s.desc}</p>
                </div>
                {i < steps.length - 1 && <div className="hidden lg:flex absolute -right-3 top-1/2 -translate-y-1/2 z-10"><ChevronRight className="w-5 h-5 text-cyan-500/40" /></div>}
              </motion.div>
            ))}
          </Section>
        </div>
      </section>

      {/* ── Features ── */}
      <section id="features" className="py-24" style={{ background: 'rgba(13,18,36,0.4)' }} aria-labelledby="features-h2">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <Section className="text-center mb-16">
            <motion.h2 id="features-h2" variants={fadeUp} className="text-3xl sm:text-4xl font-bold mb-4">Everything You Need to <span className="text-gradient-cyber">Master Security</span></motion.h2>
            <motion.p variants={fadeUp} className="text-slate-400 text-lg max-w-2xl mx-auto">A complete learning ecosystem — real practice, real feedback, real progress.</motion.p>
          </Section>
          <Section className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {features.map(f => (
              <motion.div key={f.title} variants={fadeUp} className={`glass rounded-xl p-6 border ${f.border} hover:-translate-y-1 transition-all group`}>
                <div className={`w-12 h-12 rounded-xl ${f.bg} flex items-center justify-center mb-5`}><f.icon className={`w-6 h-6 ${f.color}`} /></div>
                <h3 className="text-lg font-semibold text-white mb-3">{f.title}</h3>
                <p className="text-slate-400 text-sm leading-relaxed">{f.desc}</p>
              </motion.div>
            ))}
          </Section>
        </div>
      </section>

      {/* ── Career Paths ── */}
      <section id="careers" className="py-24" aria-labelledby="careers-h2">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <Section className="text-center mb-16">
            <motion.h2 id="careers-h2" variants={fadeUp} className="text-3xl sm:text-4xl font-bold mb-4">Choose Your <span className="text-gradient-cyber">Security Career</span></motion.h2>
            <motion.p variants={fadeUp} className="text-slate-400 text-lg max-w-2xl mx-auto">Structured pathways to the roles that matter — with certification prep and interview prep built in.</motion.p>
          </Section>
          <Section className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {careers.map(c => (
              <motion.div key={c.title} variants={fadeUp} className={`rounded-xl p-6 bg-gradient-to-br ${c.from} ${c.to} border ${c.border} hover:border-opacity-60 transition-all group cursor-pointer`}>
                <div className="flex items-start justify-between mb-4">
                  <div>
                    <div className={`text-xs font-semibold ${c.accent} mb-1 uppercase tracking-wider`}>{c.level}</div>
                    <h3 className="text-xl font-bold text-white">{c.title}</h3>
                  </div>
                  <div className="w-10 h-10 rounded-lg bg-white/10 flex items-center justify-center"><c.icon className={`w-5 h-5 ${c.accent}`} /></div>
                </div>
                <div className="flex flex-wrap gap-2 mb-4">
                  {c.tags.map(t => <span key={t} className="px-2.5 py-1 rounded-full bg-white/10 text-slate-300 text-xs font-medium">{t}</span>)}
                </div>
                <div className={`flex items-center gap-1.5 text-sm ${c.accent} font-medium group-hover:gap-3 transition-all`}>
                  Explore pathway <ArrowRight className="w-4 h-4" />
                </div>
              </motion.div>
            ))}
          </Section>
        </div>
      </section>

      {/* ── Lab Preview ── */}
      <section id="labs" className="py-24" style={{ background: 'rgba(13,18,36,0.4)' }} aria-labelledby="labs-h2">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <Section>
            <div className="grid lg:grid-cols-2 gap-12 items-center">
              <motion.div variants={fadeUp} className="space-y-6">
                <div className="inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-medium text-purple-400" style={{ background: 'rgba(124,58,237,0.1)', border: '1px solid rgba(124,58,237,0.3)' }}>
                  <Terminal className="w-4 h-4" /> Cyber Range Labs
                </div>
                <h2 id="labs-h2" className="text-3xl sm:text-4xl font-bold">Practice in a <span className="text-gradient-cyber">Safe Environment</span></h2>
                <p className="text-slate-400 text-lg leading-relaxed">All labs use synthetic data and isolated environments. Investigate real-world scenarios without touching real systems.</p>
                <ul className="space-y-3" role="list">
                  {['Phishing email analysis and detection','Authentication log investigation','Incident response decision simulation','Vulnerability triage and prioritization','Firewall rule configuration'].map(item => (
                    <li key={item} className="flex items-center gap-3 text-slate-300"><CheckCircle className="w-5 h-5 text-emerald-400 flex-shrink-0" />{item}</li>
                  ))}
                </ul>
                <Link href="/register" id="labs-cta" className="inline-flex items-center gap-2 font-semibold px-6 py-3 rounded-xl text-white transition-all hover:opacity-90 shadow-lg focus-visible-ring" style={{ background: 'linear-gradient(135deg,#7c3aed,#06b6d4)' }}>
                  Try the Labs Free <ArrowRight className="w-4 h-4" />
                </Link>
              </motion.div>

              {/* Phishing lab mockup */}
              <motion.div variants={fadeUp} className="glass-strong rounded-2xl overflow-hidden shadow-cyber-strong" style={{ border: '1px solid rgba(124,58,237,0.2)' }}>
                <div className="flex items-center gap-2 px-4 py-3" style={{ background: '#050810', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                  <div className="flex gap-1.5"><div className="w-3 h-3 rounded-full bg-rose-500" /><div className="w-3 h-3 rounded-full bg-amber-500" /><div className="w-3 h-3 rounded-full bg-emerald-500" /></div>
                  <span className="text-xs text-slate-500 font-mono ml-2">Phishing Analysis Lab — Module 3, Lab 2</span>
                </div>
                <div className="p-6 font-mono text-sm space-y-4">
                  <div>
                    <div className="text-slate-500 text-xs mb-2 uppercase tracking-wider">Suspicious Email</div>
                    <div className="rounded-lg p-4 space-y-2" style={{ background: '#050810', border: '1px solid rgba(255,255,255,0.05)' }}>
                      <div><span className="text-slate-500">From: </span><span className="text-amber-400">security-team@app1e.com</span></div>
                      <div><span className="text-slate-500">Subject: </span><span className="text-white">Urgent: Verify your account immediately</span></div>
                      <div className="pt-2 text-slate-400 text-xs" style={{ borderTop: '1px solid rgba(255,255,255,0.05)' }}>
                        Click to verify: <span className="text-rose-400 underline">http://secure.app1e.com.ru/login</span>
                      </div>
                    </div>
                  </div>
                  <div>
                    <div className="text-slate-500 text-xs mb-2 uppercase tracking-wider">Indicators Found</div>
                    <div className="space-y-1.5">
                      {[['rose','Homograph attack: app1e.com (1 not l)'],['rose','Suspicious TLD: .ru redirect'],['amber','Urgency language pressure tactic']].map(([c,t])=>(
                        <div key={t} className={`flex items-center gap-2 text-${c}-400 text-xs`}><div className={`w-1.5 h-1.5 rounded-full bg-${c}-400 flex-shrink-0`} />{t}</div>
                      ))}
                    </div>
                  </div>
                  <div className="flex gap-2" role="group" aria-label="Lab actions">
                    <button type="button" onClick={() => setPhishingAnswer('Correct: indicators show this is a phishing attempt.')} className="px-3 py-1.5 rounded-lg text-rose-400 text-xs transition-colors" style={{ background:'rgba(244,63,94,0.15)', border:'1px solid rgba(244,63,94,0.3)' }}>Mark Phishing</button>
                    <button type="button" onClick={() => setPhishingAnswer('Review the sender domain and destination URL before classifying this message.')} className="px-3 py-1.5 rounded-lg text-slate-400 text-xs" style={{ background:'rgba(255,255,255,0.04)', border:'1px solid rgba(255,255,255,0.08)' }}>Legitimate</button>
                    <button type="button" onClick={() => setPhishingAnswer('Hint: check the lookalike sender domain, suspicious redirect, and urgency language.')} className="px-3 py-1.5 rounded-lg text-slate-400 text-xs" style={{ background:'rgba(255,255,255,0.04)', border:'1px solid rgba(255,255,255,0.08)' }}>Need Hint</button>
                  </div>
                  {phishingAnswer && <p role="status" className="text-xs text-cyan-300">{phishingAnswer}</p>}
                </div>
              </motion.div>
            </div>
          </Section>
        </div>
      </section>

      {/* ── Testimonials ── */}
      <section className="py-24" aria-labelledby="testimonials-h2">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <Section className="text-center mb-16">
            <motion.p variants={fadeUp} className="text-cyan-400 text-xs font-semibold uppercase tracking-widest mb-3">Demo testimonials — representative learner outcomes</motion.p>
            <motion.h2 id="testimonials-h2" variants={fadeUp} className="text-3xl sm:text-4xl font-bold">Learners Who Made the <span className="text-gradient-cyber">Switch</span></motion.h2>
          </Section>
          <Section className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {testimonials.map(t => (
              <motion.div key={t.name} variants={fadeUp} className="glass rounded-xl p-6" style={{ border: '1px solid rgba(255,255,255,0.08)' }}>
                <div className="flex gap-1 mb-4">{[...Array(5)].map((_,i)=><Star key={i} className="w-4 h-4 fill-amber-400 text-amber-400" />)}</div>
                <p className="text-slate-300 text-sm leading-relaxed mb-6">&ldquo;{t.body}&rdquo;</p>
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-full flex items-center justify-center text-white text-xs font-bold flex-shrink-0" style={{ background: 'linear-gradient(135deg,#06b6d4,#7c3aed)' }}>{t.av}</div>
                  <div><div className="text-sm font-semibold text-white">{t.name}</div><div className="text-xs text-slate-500">{t.role} · {t.co}</div></div>
                </div>
              </motion.div>
            ))}
          </Section>
        </div>
      </section>

      {/* ── CTA ── */}
      <section id="pricing" className="py-24" style={{ background: 'rgba(13,18,36,0.4)' }} aria-labelledby="cta-h2">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <Section>
            <motion.div variants={fadeUp} className="glass-strong rounded-3xl p-12 relative overflow-hidden" style={{ border: '1px solid rgba(6,182,212,0.2)' }}>
              <div className="absolute inset-0 pointer-events-none" style={{ background: 'linear-gradient(135deg,rgba(6,182,212,0.04),rgba(124,58,237,0.04))' }} />
              <div className="relative">
                <div className="w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-6 shadow-cyber" style={{ background: 'linear-gradient(135deg,#06b6d4,#7c3aed)' }}>
                  <Shield className="w-8 h-8 text-white" />
                </div>
                <h2 id="cta-h2" className="text-3xl sm:text-4xl font-bold mb-4">Ready to Start Your <span className="text-gradient-cyber">Security Career?</span></h2>
                <p className="text-slate-400 text-lg mb-8 max-w-2xl mx-auto">Join learners building real cybersecurity skills with AI-powered mentoring and hands-on labs.</p>
                <Link href="/register" id="cta-final" className="group inline-flex items-center gap-2 font-semibold px-10 py-4 rounded-xl text-white text-lg transition-all shadow-cyber hover:opacity-90 focus-visible-ring" style={{ background: 'linear-gradient(135deg,#06b6d4,#7c3aed)' }}>
                  Get Started — It&apos;s Free <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
                </Link>
                <p className="text-slate-500 text-sm mt-5">No credit card required. Free tier: 3 modules + 2 labs.</p>
              </div>
            </motion.div>
          </Section>
        </div>
      </section>

      {/* ── Footer ── */}
      <footer style={{ borderTop: '1px solid rgba(255,255,255,0.05)' }} role="contentinfo">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-8 mb-8">
            <div className="col-span-2 lg:col-span-1">
              <Link href="/" className="flex items-center gap-2 mb-4 focus-visible-ring rounded-lg w-fit">
                <div className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ background: 'linear-gradient(135deg,#06b6d4,#7c3aed)' }}><Shield className="w-3.5 h-3.5 text-white" /></div>
                <span className="font-bold"><span className="text-gradient-cyber">Cyber</span><span className="text-white">Mentor AI</span></span>
              </Link>
              <p className="text-slate-500 text-sm leading-relaxed">AI-powered cybersecurity education. Learn, practice, and grow into your security career.</p>
            </div>
            {footerGroups.map(group => (
              <div key={group.title}>
                <h4 className="font-semibold text-white mb-4 text-sm">{group.title}</h4>
                <ul className="space-y-2">
                  {group.links.map(link => <li key={link.label}><a href={link.href} className="text-slate-500 hover:text-cyan-400 text-sm transition-colors">{link.label}</a></li>)}
                </ul>
              </div>
            ))}
          </div>
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4" style={{ borderTop: '1px solid rgba(255,255,255,0.05)', paddingTop: '2rem' }}>
            <p className="text-slate-500 text-sm">© 2025 CyberMentor AI. All rights reserved. <span className="text-slate-600">Demo data shown is fictional.</span></p>
            <div className="flex items-center gap-2 text-slate-500 text-sm"><Globe className="w-4 h-4" /> English</div>
          </div>
        </div>
      </footer>
    </div>
  )
}
