import { BrandMark } from '@/presentation/components/shell/BrandMark'

const SAMPLE_LINES = [
  { n: 1, code: 'const progress = await leetcode.sync()', tone: 'text-foreground' },
  { n: 2, code: 'coach.find(progress.weakTopics)', tone: 'text-foreground' },
  { n: 3, code: '// → graphs, dynamic programming', tone: 'text-muted-foreground' },
  { n: 4, code: 'interview.practice({ level: "hard" })', tone: 'text-foreground' },
  { n: 5, code: 'return offer', tone: 'text-primary' },
]

const FEATURES = ['AI coach and gap analysis', 'Mock coding & system-design interviews', 'Auto-generated problem notes']

interface AuthLayoutProps {
  readonly eyebrow: string
  readonly title: string
  readonly description: string
  readonly children: React.ReactNode
}

/** Split auth screen: brand story on the left, form on the right. */
export function AuthLayout({ eyebrow, title, description, children }: AuthLayoutProps) {
  return (
    <div className="grid min-h-screen lg:grid-cols-[1.1fr_1fr]">
      <aside className="relative hidden overflow-hidden border-r bg-sidebar/60 p-10 lg:flex lg:flex-col lg:justify-between">
        <div aria-hidden className="absolute -top-32 -left-24 size-[28rem] rounded-full bg-signal/12 blur-3xl" />
        <div aria-hidden className="absolute -right-24 bottom-0 size-80 rounded-full bg-info/10 blur-3xl" />

        <div className="relative">
          <BrandMark href="/login" />
        </div>

        <div className="relative space-y-8">
          <h2 className="max-w-md text-5xl leading-[1.02] font-semibold">
            Turn practice into <span className="text-primary">offers</span>.
          </h2>
          <pre
            aria-hidden
            className="panel max-w-md p-5 font-mono text-[0.82rem] leading-7"
          >
            {SAMPLE_LINES.map((line, i) => (
              <div key={line.n} className="rise flex gap-4" style={{ '--i': i + 2 } as React.CSSProperties}>
                <span className="w-4 text-right text-muted-foreground/50 select-none">{line.n}</span>
                <span className={line.tone}>{line.code}</span>
              </div>
            ))}
          </pre>
          <ul className="space-y-2 text-sm text-muted-foreground">
            {FEATURES.map((f) => (
              <li key={f} className="flex items-center gap-2.5">
                <span aria-hidden className="size-1.5 rounded-full bg-primary shadow-[0_0_10px_var(--signal)]" />
                {f}
              </li>
            ))}
          </ul>
        </div>

        <p className="relative font-mono text-xs text-muted-foreground">v0.1 · built for the grind</p>
      </aside>

      <main className="flex items-center justify-center px-5 py-12 sm:px-10">
        <div className="w-full max-w-sm space-y-8">
          <div className="lg:hidden">
            <BrandMark href="/login" />
          </div>
          <div className="rise space-y-2">
            <p className="eyebrow">{eyebrow}</p>
            <h1 className="text-3xl font-semibold">{title}</h1>
            <p className="text-sm text-muted-foreground">{description}</p>
          </div>
          <div className="rise" style={{ '--i': 1 } as React.CSSProperties}>
            {children}
          </div>
        </div>
      </main>
    </div>
  )
}
