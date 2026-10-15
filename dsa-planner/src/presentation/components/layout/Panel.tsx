import { cn } from '@/lib/utils'

interface PanelProps {
  readonly title?: string
  readonly eyebrow?: string
  readonly action?: React.ReactNode
  readonly className?: string
  /** Stagger step for the entrance animation. */
  readonly index?: number
  readonly children: React.ReactNode
}

/** Dashboard section card with an optional mono label and title row. */
export function Panel({ title, eyebrow, action, className, index = 0, children }: PanelProps) {
  return (
    <section
      className={cn('panel rise p-5 sm:p-6', className)}
      style={{ '--i': index } as React.CSSProperties}
    >
      {(title || eyebrow || action) && (
        <div className="mb-4 flex items-start justify-between gap-3">
          <div className="space-y-1">
            {eyebrow && <p className="eyebrow">{eyebrow}</p>}
            {title && <h2 className="text-lg font-semibold">{title}</h2>}
          </div>
          {action}
        </div>
      )}
      {children}
    </section>
  )
}
