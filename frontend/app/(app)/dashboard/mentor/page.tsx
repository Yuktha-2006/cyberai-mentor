'use client'

import { useState } from 'react'
import Link from 'next/link'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Brain, Send, ArrowLeft, Shield, AlertTriangle,
  Sparkles, Terminal, BookOpen, User, Bot, RotateCcw,
  ChevronRight, Lightbulb, CheckCircle2, Wrench, ExternalLink,
  Code2, ChevronDown, ChevronUp
} from 'lucide-react'
import toast from 'react-hot-toast'

interface ToolExecution {
  tool: string
  status: string
  summary: string
}

interface ActionCard {
  title: string
  description: string
  url: string
  badge: string
}

interface Message {
  id: string
  role: 'user' | 'assistant'
  content: string
  timestamp: string
  action_summary?: string
  agent_thought?: string
  tools_executed?: ToolExecution[]
  action_cards?: ActionCard[]
  suggested_topics?: string[]
}

const INITIAL_MESSAGES: Message[] = [
  {
    id: 'm1',
    role: 'assistant',
    content: "Greetings, Defender! I am your CyberMentor AI Autonomous Agent.\n\nI actively audit your curriculum telemetry, inspect security code snippets for CWE vulnerabilities, map attack scenarios to the MITRE ATT&CK matrix, and build personalized remediation plans.\n\nWhat would you like to investigate?",
    timestamp: 'Just now',
    agent_thought: "Initialized autonomous cyber defense agent. Ready to ingest telemetry and code queries.",
    tools_executed: [
      { tool: "audit_learner_portfolio", status: "active", summary: "Loaded learner profile, level, and diagnostic domain metrics." }
    ],
    action_cards: [
      {
        title: "SOC Range Lab #01",
        description: "Triage a live SSH brute-force attack and apply firewall containment rules.",
        url: "/dashboard/labs",
        badge: "Interactive Lab"
      },
      {
        title: "Network Defense Curriculum",
        description: "Study the OSI model, packet handshakes, and firewall state tables.",
        url: "/dashboard/learn/network-defense-fundamentals",
        badge: "Curriculum"
      }
    ],
    suggested_topics: [
      "How should I review?",
      "Explain the MITRE ATT&CK framework",
      "Audit this code: query = f'SELECT * FROM users WHERE id={id}'",
      "Explain TCP 3-way handshake & SYN flood"
    ]
  }
]

export default function MentorPage() {
  const [messages, setMessages] = useState<Message[]>(INITIAL_MESSAGES)
  const [input, setInput] = useState('')
  const [thinking, setThinking] = useState(false)
  const [expandedThoughts, setExpandedThoughts] = useState<Record<string, boolean>>({})

  const toggleThought = (id: string) => {
    setExpandedThoughts(prev => ({ ...prev, [id]: !prev[id] }))
  }

  const sendMessage = async (text: string) => {
    if (!text.trim() || thinking) return

    const userMsg: Message = {
      id: `m${messages.length + 1}`,
      role: 'user',
      content: text.trim(),
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    }

    const updatedMessages = [...messages, userMsg]
    setMessages(updatedMessages)
    setInput('')
    setThinking(true)

    try {
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'
      const historyPayload = updatedMessages.slice(-6).map(m => ({
        role: m.role,
        content: m.content
      }))

      const res = await fetch(`${apiUrl}/api/v1/mentor/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          message: text.trim(),
          history: historyPayload
        })
      })

      if (!res.ok) {
        throw new Error('Failed to reach AI mentor agent.')
      }

      const data = await res.json()
      const botMsg: Message = {
        id: `${userMsg.id}-assistant`,
        role: 'assistant',
        content: data.reply,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        action_summary: data.action_summary || data.agent_thought,
        agent_thought: data.action_summary || data.agent_thought,
        tools_executed: data.tools_executed,
        action_cards: data.action_cards,
        suggested_topics: data.suggested_topics
      }
      setMessages(prev => [...prev, botMsg])
    } catch {
      toast.error('Network error communicating with agent.')
      const fallbackMsg: Message = {
        id: `${userMsg.id}-assistant`,
        role: 'assistant',
        content: "I could not communicate with the backend service. Please verify that the FastAPI backend is running on port 8000.",
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      }
      setMessages(prev => [...prev, fallbackMsg])
    } finally {
      setThinking(false)
    }
  }

  const handleSend = (e: React.FormEvent) => {
    e.preventDefault()
    sendMessage(input)
  }

  return (
    <div className="min-h-screen flex flex-col" style={{ backgroundColor: '#0a0f1e', color: '#f1f5f9' }}>
      {/* Top Header */}
      <header className="border-b border-white/5 glass sticky top-0 z-20">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link
              href="/dashboard"
              className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-white/5 transition-all flex items-center gap-1.5 text-xs font-medium"
            >
              <ArrowLeft className="w-4 h-4" /> Dashboard
            </Link>
            <span className="text-slate-600">/</span>
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-lg bg-gradient-to-tr from-cyan-500 to-purple-600 flex items-center justify-center text-white shadow-cyber">
                <Brain className="w-4 h-4" />
              </div>
              <div>
                <span className="text-xs font-bold text-white block">CyberMentor Autonomous Agent</span>
                <span className="text-[10px] text-slate-400 font-mono">Tool-Augmented Defense Reasoning</span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-[11px] px-2.5 py-1 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 flex items-center gap-1.5 font-medium">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
              Agent Active
            </span>
          </div>
        </div>
      </header>

      {/* Main Conversation Stream */}
      <main className="flex-1 max-w-4xl w-full mx-auto px-4 sm:px-6 py-6 flex flex-col" role="main">
        {/* Messages List */}
        <div className="flex-1 space-y-6 mb-6">
          {messages.map(msg => (
            <motion.div
              key={msg.id}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              className={`flex flex-col ${msg.role === 'user' ? 'items-end' : 'items-start'}`}
            >
              <div className={`flex gap-3.5 max-w-[95%] sm:max-w-[85%] ${msg.role === 'user' ? 'flex-row-reverse' : 'flex-row'}`}>
                {msg.role === 'assistant' ? (
                  <div className="w-8 h-8 rounded-xl bg-purple-500/20 border border-purple-500/30 flex items-center justify-center text-purple-400 flex-shrink-0 mt-1">
                    <Brain className="w-4 h-4" />
                  </div>
                ) : (
                  <div className="w-8 h-8 rounded-xl bg-cyan-500/20 border border-cyan-500/30 flex items-center justify-center text-cyan-400 flex-shrink-0 mt-1">
                    <User className="w-4 h-4" />
                  </div>
                )}

                <div className="flex-1 min-w-0 space-y-3">
                  {/* Agent Action Summary & Tools Accordion */}
                  {msg.role === 'assistant' && (msg.action_summary || msg.agent_thought || (msg.tools_executed && msg.tools_executed.length > 0)) && (
                    <div className="glass rounded-xl border border-purple-500/20 bg-purple-950/20 text-xs overflow-hidden">
                      <button
                        onClick={() => toggleThought(msg.id)}
                        className="w-full px-3.5 py-2 flex items-center justify-between text-purple-300 font-mono text-[11px] hover:bg-white/5 transition-colors"
                      >
                        <span className="flex items-center gap-1.5">
                          <Wrench className="w-3.5 h-3.5 text-purple-400" />
                          <span>Agent Action Trace ({msg.tools_executed?.length ?? 1} tools invoked)</span>
                        </span>
                        {expandedThoughts[msg.id] ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                      </button>

                      {expandedThoughts[msg.id] && (
                        <div className="px-3.5 pb-3 pt-1 space-y-2 border-t border-purple-500/10 font-mono text-[11px] text-slate-300">
                          {(msg.action_summary || msg.agent_thought) && (
                            <div className="text-purple-200/90 text-xs font-sans bg-purple-900/30 p-2 rounded-lg border border-purple-500/20">
                              <span className="font-semibold text-purple-300">Action Summary:</span> {msg.action_summary || msg.agent_thought}
                            </div>
                          )}
                          {msg.tools_executed?.map((t, idx) => (
                            <div key={idx} className="flex items-start gap-2 bg-black/30 p-2 rounded-lg border border-white/5">
                              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 flex-shrink-0 mt-0.5" />
                              <div>
                                <span className="text-cyan-400 font-semibold">{t.tool}()</span>
                                <span className="text-slate-400 ml-1">→ {t.summary}</span>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}

                  {/* Message Bubble */}
                  <div
                    className={`rounded-2xl p-4 text-xs sm:text-sm leading-relaxed ${
                      msg.role === 'user'
                        ? 'bg-cyan-500/20 text-cyan-50 border border-cyan-500/30 rounded-tr-sm'
                        : 'glass border border-white/10 text-slate-200 rounded-tl-sm'
                    }`}
                  >
                    <div className="whitespace-pre-line font-sans">{msg.content}</div>
                    <div className="text-[10px] text-slate-500 mt-2 text-right">
                      {msg.timestamp}
                    </div>
                  </div>

                  {/* Action Cards (Direct Platform Navigation) */}
                  {msg.action_cards && msg.action_cards.length > 0 && (
                    <div className="grid sm:grid-cols-2 gap-2.5 pt-1">
                      {msg.action_cards.map((card, cIdx) => (
                        <Link
                          key={cIdx}
                          href={card.url}
                          className="p-3 rounded-xl glass border border-white/10 hover:border-cyan-500/40 transition-all flex items-start justify-between group"
                        >
                          <div>
                            <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-cyan-500/10 text-cyan-400 border border-cyan-500/20">
                              {card.badge}
                            </span>
                            <div className="text-xs font-semibold text-white group-hover:text-cyan-300 transition-colors mt-1.5">
                              {card.title}
                            </div>
                            <div className="text-[11px] text-slate-400 mt-0.5 line-clamp-1">
                              {card.description}
                            </div>
                          </div>
                          <ExternalLink className="w-3.5 h-3.5 text-slate-500 group-hover:text-cyan-400 transition-colors flex-shrink-0 mt-1" />
                        </Link>
                      ))}
                    </div>
                  )}

                  {/* Suggested Topic Pills */}
                  {msg.suggested_topics && msg.suggested_topics.length > 0 && (
                    <div className="flex flex-wrap gap-2 pt-1">
                      {msg.suggested_topics.map((topic, tIdx) => (
                        <button
                          key={tIdx}
                          onClick={() => sendMessage(topic)}
                          disabled={thinking}
                          className="px-3 py-1.5 rounded-xl bg-white/[0.04] hover:bg-cyan-500/10 border border-white/10 hover:border-cyan-500/30 text-xs text-slate-300 hover:text-cyan-300 transition-all flex items-center gap-1.5 group disabled:opacity-50"
                        >
                          <Lightbulb className="w-3 h-3 text-cyan-400 group-hover:scale-110 transition-transform" />
                          <span>{topic}</span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </motion.div>
          ))}

          {thinking && (
            <div className="flex gap-3.5 items-center">
              <div className="w-8 h-8 rounded-xl bg-purple-500/20 border border-purple-500/30 flex items-center justify-center text-purple-400 flex-shrink-0">
                <Brain className="w-4 h-4 animate-pulse" />
              </div>
              <div className="glass px-4 py-3 rounded-2xl rounded-tl-sm border border-white/10 text-xs text-slate-400 flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-cyan-400 animate-ping" />
                Executing agent tools & synthesizing cybersecurity intelligence...
              </div>
            </div>
          )}
        </div>

        {/* Input Bar with Code Paste Shortcut */}
        <div className="space-y-2">
          <form onSubmit={handleSend} className="glass rounded-2xl p-2 border border-white/10 flex items-center gap-2">
            <input
              type="text"
              value={input}
              onChange={e => setInput(e.target.value)}
              placeholder="Ask anything, paste code to audit for CWEs, or ask for your next investigation target..."
              className="flex-1 bg-transparent px-4 py-2.5 text-xs sm:text-sm text-white placeholder-slate-500 focus:outline-none"
            />
            <button
              type="submit"
              disabled={!input.trim() || thinking}
              className="p-2.5 rounded-xl text-white shadow-cyber transition-all hover:opacity-90 disabled:opacity-40 disabled:cursor-not-allowed flex-shrink-0"
              style={{ background: 'linear-gradient(135deg, #06b6d4, #7c3aed)' }}
              aria-label="Send message"
            >
              <Send className="w-4 h-4" />
            </button>
          </form>

          {/* Quick prompt triggers */}
          <div className="flex items-center gap-2 px-2 text-[11px] text-slate-500">
            <span>Agent Shortcuts:</span>
            <button
              onClick={() => sendMessage("Audit this code for vulnerabilities:\n\n```python\nquery = f\"SELECT * FROM users WHERE user_id = '{user_input}'\"\ndb.execute(query)\n```")}
              className="hover:text-cyan-400 transition-colors flex items-center gap-1"
            >
              <Code2 className="w-3 h-3" /> Audit SQL Snippet
            </button>
            <span>•</span>
            <button
              onClick={() => sendMessage("What should be my next study priority based on my diagnostic gaps?")}
              className="hover:text-cyan-400 transition-colors"
            >
              Analyze My Skill Gaps
            </button>
          </div>
        </div>
      </main>
    </div>
  )
}
