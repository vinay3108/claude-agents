import { LogoutButton } from '@/presentation/components/LogoutButton'
import { ThemeToggle } from './ThemeToggle'

interface UserBadgeProps {
  readonly email: string
}

export function UserBadge({ email }: UserBadgeProps) {
  const initial = email.charAt(0).toUpperCase() || '?'
  return (
    <div className="flex items-center gap-3 rounded-xl border bg-card/60 p-2.5">
      <span
        aria-hidden
        className="grid size-8 shrink-0 place-items-center rounded-full bg-accent font-heading text-sm font-semibold text-primary"
      >
        {initial}
      </span>
      <div className="min-w-0 flex-1">
        <p className="eyebrow !tracking-[0.12em]">Signed in</p>
        <p className="truncate text-xs text-foreground" title={email}>
          {email}
        </p>
      </div>
      <ThemeToggle />
      <LogoutButton />
    </div>
  )
}
