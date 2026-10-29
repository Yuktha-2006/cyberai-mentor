import Link from 'next/link'

export default function PrivacyPage() {
  return (
    <main className="min-h-screen px-4 py-16" style={{ backgroundColor: '#0a0f1e', color: '#f1f5f9' }}>
      <article className="mx-auto max-w-3xl space-y-6">
        <Link href="/register" className="text-sm text-cyan-400 hover:text-cyan-300">Back to registration</Link>
        <h1 className="text-3xl font-bold">Privacy Notice</h1>
        <p className="text-slate-300">This educational demo stores account and learning-progress data in the configured PostgreSQL database. Operators of a deployment control that database and its retention.</p>
        <p className="text-slate-400">If an external AI provider is configured, mentor messages may be sent to that provider to generate a response. Avoid entering passwords, API keys, or sensitive personal or organizational information.</p>
      </article>
    </main>
  )
}