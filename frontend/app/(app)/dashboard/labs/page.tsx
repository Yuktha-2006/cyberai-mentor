'use client'

import { useState } from 'react'
import Link from 'next/link'
import { motion } from 'framer-motion'
import {
  Terminal, ArrowLeft, Shield, AlertTriangle, Play,
  CheckCircle, RefreshCw, Search, Eye, Filter
} from 'lucide-react'
import toast from 'react-hot-toast'

interface SecurityLog {
  id: string
  timestamp: string
  source_ip: string
  dest_port: number
  event_type: string
  action: 'BLOCKED' | 'ALLOWED' | 'ALERT'
  raw_payload: string
}

const SAMPLE_LOGS: SecurityLog[] = [
  { id: 'log-1', timestamp: '2026-10-27 12:01:04', source_ip: '192.168.1.105', dest_port: 80, event_type: 'HTTP GET /', action: 'ALLOWED', raw_payload: 'GET /index.html HTTP/1.1 User-Agent: Mozilla/5.0' },
  { id: 'log-2', timestamp: '2026-10-27 12:02:15', source_ip: '45.33.32.156', dest_port: 22, event_type: 'SSH AUTH_FAILURE', action: 'ALERT', raw_payload: 'Failed password for root from 45.33.32.156 port 54812 ssh2' },
  { id: 'log-3', timestamp: '2026-10-27 12:02:18', source_ip: '45.33.32.156', dest_port: 22, event_type: 'SSH AUTH_FAILURE', action: 'ALERT', raw_payload: 'Failed password for admin from 45.33.32.156 port 54814 ssh2' },
  { id: 'log-4', timestamp: '2026-10-27 12:02:22', source_ip: '45.33.32.156', dest_port: 22, event_type: 'SSH AUTH_FAILURE', action: 'ALERT', raw_payload: 'Failed password for ubuntu from 45.33.32.156 port 54816 ssh2' },
  { id: 'log-5', timestamp: '2026-10-27 12:05:40', source_ip: '10.0.0.45', dest_port: 443, event_type: 'HTTPS POST /api/login', action: 'ALLOWED', raw_payload: 'POST /api/login HTTP/2.0 Status: 200 OK' },
  { id: 'log-6', timestamp: '2026-10-27 12:08:12', source_ip: '198.51.100.4', dest_port: 80, event_type: 'SQLI_ATTEMPT', action: 'BLOCKED', raw_payload: "GET /products?category=1' OR '1'='1 HTTP/1.1 WAF: Rule 942100 Triggered" },
]

export default function LabsPage() {
  const [filterIp, setFilterIp] = useState('')
  const [selectedLog, setSelectedLog] = useState<SecurityLog | null>(null)
  const [containedIps, setContainedIps] = useState<string[]>([])
  const [labSolved, setLabSolved] = useState(false)

  const handleIsolateIp = (ip: string) => {
    if (containedIps.includes(ip)) {
      toast('Host is already isolated in firewall table.', { icon: 'ℹ️' })
      return
    }
    const updated = [...containedIps, ip]
    setContainedIps(updated)
    toast.success(`Firewall DROP rule applied for ${ip}!`)

    if (ip === '45.33.32.156') {
      setLabSolved(true)
      toast.success('Investigation complete! Malicious SSH brute force attacker contained! +100 XP', { duration: 5000 })
    }
  }

  const filteredLogs = filterIp
    ? SAMPLE_LOGS.filter(l => l.source_ip.includes(filterIp) || l.event_type.toLowerCase().includes(filterIp.toLowerCase()))
    : SAMPLE_LOGS

  return (
    <div className="min-h-screen flex flex-col" style={{ backgroundColor: '#0a0f1e', color: '#f1f5f9' }}>
      {/* Top Bar */}
      <header className="border-b border-white/5 glass sticky top-0 z-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link
              href="/dashboard"
              className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-white/5 transition-all flex items-center gap-1.5 text-xs font-medium"
            >
              <ArrowLeft className="w-4 h-4" /> Dashboard
            </Link>
            <span className="text-slate-600">/</span>
            <div className="flex items-center gap-2">
              <div className="w-6 h-6 rounded-lg bg-cyan-500/20 flex items-center justify-center text-cyan-400">
                <Terminal className="w-3.5 h-3.5" />
              </div>
              <span className="text-xs font-semibold text-white">SOC Range Lab #01</span>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {labSolved && (
              <span className="text-xs px-3 py-1 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 font-semibold flex items-center gap-1.5">
                <CheckCircle className="w-3.5 h-3.5" /> Lab Completed
              </span>
            )}
          </div>
        </div>
      </header>

      {/* Main Lab Interface */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 py-8" role="main">
        {/* Lab Briefing Header */}
        <div className="mb-6 p-6 glass rounded-2xl border border-white/10">
          <div className="flex items-start justify-between gap-4">
            <div>
              <span className="text-xs font-mono text-cyan-400 uppercase tracking-wider">
                Simulated Incident Investigation
              </span>
              <h1 className="text-xl font-bold text-white mt-1">
                Scenario: SSH Brute-Force Triage & Containment
              </h1>
              <p className="text-xs text-slate-400 mt-1 max-w-3xl leading-relaxed">
                A production gateway host is experiencing repeated authentication alarms. Filter the audit stream, identify the external IP orchestrating credential stuffing, and execute a firewall containment block to isolate the adversary.
              </p>
              <div className="mt-3 inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-cyan-950/40 border border-cyan-500/30 text-[11px] text-cyan-300">
                <Shield className="w-3.5 h-3.5 text-cyan-400 flex-shrink-0" />
                <span>
                  <strong>Safe Virtual Simulation:</strong> All IP triage, firewall rule generation, and host isolation occur strictly in this sandboxed browser simulation and cannot execute host OS commands or modify physical network adapters.
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* SIEM Log Viewer */}
        <div className="grid lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-4">
            {/* Search filter bar */}
            <div className="flex items-center gap-3">
              <div className="relative flex-1">
                <Search className="w-4 h-4 absolute left-3 top-3 text-slate-500" />
                <input
                  type="text"
                  placeholder="Filter by IP (e.g. 45.33.32.156) or event type..."
                  value={filterIp}
                  onChange={e => setFilterIp(e.target.value)}
                  className="w-full bg-white/[0.04] border border-white/10 rounded-xl pl-9 pr-4 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500/50"
                />
              </div>
            </div>

            {/* Log Table */}
            <div className="glass rounded-2xl border border-white/10 overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-white/[0.03] border-b border-white/5 text-slate-400 font-mono text-[11px]">
                    <tr>
                      <th className="p-3">Timestamp</th>
                      <th className="p-3">Source IP</th>
                      <th className="p-3">Port</th>
                      <th className="p-3">Event Type</th>
                      <th className="p-3">Action</th>
                      <th className="p-3 text-right">Inspect</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/5 font-mono">
                    {filteredLogs.map(log => {
                      const isIsolated = containedIps.includes(log.source_ip)
                      return (
                        <tr key={log.id} className="hover:bg-white/[0.02] transition-colors">
                          <td className="p-3 text-slate-400 text-[11px] whitespace-nowrap">{log.timestamp}</td>
                          <td className="p-3 text-cyan-300 font-medium">{log.source_ip}</td>
                          <td className="p-3 text-slate-400">{log.dest_port}</td>
                          <td className="p-3 text-slate-200">{log.event_type}</td>
                          <td className="p-3">
                            <span className={`px-2 py-0.5 rounded text-[10px] font-semibold ${
                              log.action === 'BLOCKED' ? 'bg-rose-500/20 text-rose-300' :
                              log.action === 'ALERT' ? 'bg-amber-500/20 text-amber-300' :
                              'bg-emerald-500/20 text-emerald-300'
                            }`}>
                              {isIsolated ? 'CONTAINED' : log.action}
                            </span>
                          </td>
                          <td className="p-3 text-right">
                            <button
                              onClick={() => setSelectedLog(log)}
                              className="p-1 rounded hover:bg-white/10 text-slate-400 hover:text-white transition-colors"
                              title="Inspect Payload"
                            >
                              <Eye className="w-3.5 h-3.5" />
                            </button>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          {/* Details & Containment Panel */}
          <div className="space-y-6">
            <div className="glass rounded-2xl p-5 border border-white/10">
              <h3 className="text-xs font-bold text-slate-300 uppercase tracking-wider mb-3">
                Telemetry Inspector
              </h3>

              {selectedLog ? (
                <div className="space-y-4 text-xs font-mono">
                  <div>
                    <span className="text-slate-500">Event ID:</span>
                    <div className="text-white mt-0.5">{selectedLog.id}</div>
                  </div>
                  <div>
                    <span className="text-slate-500">Source IP:</span>
                    <div className="text-cyan-400 font-bold mt-0.5">{selectedLog.source_ip}</div>
                  </div>
                  <div>
                    <span className="text-slate-500">Payload Stream:</span>
                    <div className="p-3 rounded-xl bg-black/40 border border-white/5 text-amber-300 break-all mt-1 leading-relaxed text-[11px]">
                      {selectedLog.raw_payload}
                    </div>
                  </div>

                  <div className="pt-3 border-t border-white/5">
                    <button
                      onClick={() => handleIsolateIp(selectedLog.source_ip)}
                      disabled={containedIps.includes(selectedLog.source_ip)}
                      className="w-full py-2.5 px-4 rounded-xl font-sans text-xs font-semibold text-white transition-all bg-rose-600 hover:bg-rose-500 disabled:opacity-40 disabled:cursor-not-allowed shadow-cyber"
                    >
                      {containedIps.includes(selectedLog.source_ip) ? 'IP Contained in Firewall' : 'Isolate Source IP (DROP)'}
                    </button>
                  </div>
                </div>
              ) : (
                <div className="text-center py-8 text-slate-500 text-xs font-sans">
                  Select a telemetry event from the audit table to dissect its payload.
                </div>
              )}
            </div>

            {/* Firewall Rule State */}
            <div className="glass rounded-2xl p-5 border border-white/10">
              <h3 className="text-xs font-bold text-slate-300 uppercase tracking-wider mb-2">
                Active Containment Rules ({containedIps.length})
              </h3>
              {containedIps.length === 0 ? (
                <div className="text-xs text-slate-500">No containment drops currently active.</div>
              ) : (
                <div className="space-y-1.5 font-mono text-xs">
                  {containedIps.map(ip => (
                    <div key={ip} className="p-2 rounded-lg bg-rose-500/10 border border-rose-500/20 text-rose-300 flex items-center justify-between">
                      <span>DROP {ip}</span>
                      <span className="text-[10px] text-slate-400">ACTIVE</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </main>
    </div>
  )
}
