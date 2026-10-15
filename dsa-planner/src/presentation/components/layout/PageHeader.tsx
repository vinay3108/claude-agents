import { cn } from '@/lib/utils'

interface PageHeaderProps {
  /** Small mono label above the title, e.g. "// practice". */
  readonly eyebrow: string
  readonly title: React.ReactNode
  readonly description?: React.ReactNode
  /** Right-aligned controls (buttons, filters). */
  readonly actions?: React.ReactNode
  readonly className?: string
}

/** Shared page title block, so every screen opens the same way. */
export function PageHeader({ eyebrow, title, description, actions, className }: PageHeaderProps) {
  return (
    <header
      className={cn('rise flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between', className)}
    >
      <div className="max-w-2xl space-y-2">
        <p className="eyebrow">{eyebrow}</p>
        <h1 className="text-3xl font-semibold sm:text-4xl">{title}</h1>
        {description && <p className="text-sm text-muted-foreground sm:text-base">{description}</p>}
      </div>
      {actions && <div className="flex shrink-0 items-center gap-2">{actions}</div>}
    </header>
  )
}
