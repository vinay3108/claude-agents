'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { cn } from '@/lib/utils'
import { NAV_SECTIONS, isNavItemActive } from './navigation'

interface SidebarNavProps {
  /** Called after a link is chosen (the mobile drawer uses it to close). */
  readonly onNavigate?: () => void
}

export function SidebarNav({ onNavigate }: SidebarNavProps) {
  const pathname = usePathname()

  return (
    <nav aria-label="Main" className="flex flex-col gap-6">
      {NAV_SECTIONS.map((section) => (
        <div key={section.title} className="flex flex-col gap-1">
          <p className="eyebrow px-3 pb-1">{section.title}</p>
          {section.items.map(({ href, label, icon: Icon }) => {
            const active = isNavItemActive(pathname, href)
            return (
              <Link
                key={href}
                href={href}
                onClick={onNavigate}
                aria-current={active ? 'page' : undefined}
                className={cn(
                  'group relative flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors outline-none focus-visible:ring-2 focus-visible:ring-ring',
                  active
                    ? 'bg-sidebar-accent text-sidebar-accent-foreground'
                    : 'text-muted-foreground hover:bg-sidebar-accent/60 hover:text-foreground',
                )}
              >
                <span
                  aria-hidden
                  className={cn(
                    'absolute top-1.5 bottom-1.5 left-0 w-0.5 rounded-full bg-primary transition-opacity',
                    active ? 'opacity-100' : 'opacity-0',
                  )}
                />
                <Icon
                  aria-hidden
                  className={cn('size-4 transition-colors', active ? 'text-primary' : 'group-hover:text-foreground')}
                />
                {label}
              </Link>
            )
          })}
        </div>
      ))}
    </nav>
  )
}
