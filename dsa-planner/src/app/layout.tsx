import type { Metadata } from 'next'
import { Bricolage_Grotesque, IBM_Plex_Sans, JetBrains_Mono } from 'next/font/google'
import { QueryProvider } from '@/presentation/components/QueryProvider'
import { ThemeProvider } from '@/presentation/components/ThemeProvider'
import './globals.css'

const display = Bricolage_Grotesque({ variable: '--font-display', subsets: ['latin'] })
const body = IBM_Plex_Sans({
  variable: '--font-body',
  subsets: ['latin'],
  weight: ['400', '500', '600'],
})
const code = JetBrains_Mono({ variable: '--font-code', subsets: ['latin'] })

export const metadata: Metadata = {
  title: 'DSA Progress Analyzer',
  description: 'Track your LeetCode progress and get AI-powered study recommendations.',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={`${display.variable} ${body.variable} ${code.variable} h-full antialiased`}
    >
      <body className="canvas-atmosphere min-h-full flex flex-col">
        <ThemeProvider>
          <QueryProvider>{children}</QueryProvider>
        </ThemeProvider>
      </body>
    </html>
  )
}
