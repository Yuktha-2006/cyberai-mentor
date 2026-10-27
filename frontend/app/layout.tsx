import type { Metadata } from 'next'
import './globals.css'
import { Toaster } from 'react-hot-toast'

export const metadata: Metadata = {
  title: { default: 'CyberMentor AI', template: '%s | CyberMentor AI' },
  description: 'Master cybersecurity with personalized AI mentoring, hands-on labs, and structured learning paths. From beginner to SOC analyst, cloud security, and GRC professional.',
  keywords: ['cybersecurity', 'AI mentor', 'security training', 'SOC analyst', 'ethical hacking', 'learn cybersecurity', 'cyber range'],
  openGraph: {
    title: 'CyberMentor AI — Your AI-Powered Cybersecurity Learning Platform',
    description: 'Personalized cybersecurity education with AI mentoring and real hands-on labs.',
    type: 'website',
  },
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="dark">
      <body className="bg-navy-900 text-slate-100 antialiased min-h-screen font-sans" style={{ backgroundColor: '#0a0f1e' }}>
        {children}
        <Toaster
          position="top-right"
          toastOptions={{
            style: {
              background: '#0d1224',
              color: '#f1f5f9',
              border: '1px solid rgba(6,182,212,0.3)',
              borderRadius: '0.75rem',
            },
            success: { iconTheme: { primary: '#10b981', secondary: '#0d1224' } },
            error: { iconTheme: { primary: '#f43f5e', secondary: '#0d1224' } },
          }}
        />
      </body>
    </html>
  )
}
