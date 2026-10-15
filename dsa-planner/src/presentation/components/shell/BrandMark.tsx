import Link from 'next/link'

interface BrandMarkProps {
  readonly href?: string
}

/** Logo: a bracketed glyph plus the product name. */
export function BrandMark({ href = '/dashboard' }: BrandMarkProps) {
  return (
    <Link
      href={href}
      className="group flex items-center gap-2.5 rounded-lg outline-none focus-visible:ring-2 focus-visible:ring-ring"
    >
      <span
        aria-hidden
        className="grid size-8 place-items-center rounded-lg bg-primary font-mono text-sm font-bold text-primary-foreground shadow-[0_0_24px_-4px_var(--signal)] transition-transform group-hover:-rotate-6"
      >
        {'{}'}
      </span>
      <span className="font-heading text-[1.05rem] font-semibold tracking-tight">
        dsa<span className="text-primary">.</span>planner
      </span>
    </Link>
  )
}
