import Link from 'next/link'

export default function TermsPage() {
  return (
    <main className="min-h-screen px-4 py-16" style={{ backgroundColor: '#0a0f1e', color: '#f1f5f9' }}>
      <article className="mx-auto max-w-3xl space-y-6">
        <Link href="/register" className="text-sm text-cyan-400 hover:text-cyan-300">Back to registration</Link>
        <h1 className="text-3xl font-bold">Terms of Service</h1>
        <p className="text-slate-300">CyberMentor AI is an educational demonstration. Use the platform and simulated labs only for authorized learning. Lab actions use synthetic browser data and do not authorize testing real systems.</p>
        <p className="text-slate-400">Do not submit secrets, sensitive personal information, or data you are not authorized to share. Local deployments are provided as-is for evaluation and development.</p>
      </article>
    </main>
  )
}