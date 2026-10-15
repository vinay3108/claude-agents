'use client'

import { useEffect, useState } from 'react'
import { usePathname } from 'next/navigation'
import { Menu, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { BrandMark } from './BrandMark'
import { SidebarNav } from './SidebarNav'

interface MobileNavProps {
  /** Footer content for the drawer (the signed-in user). */
  readonly footer: React.ReactNode
}

/** Top bar with a slide-in drawer, shown below the `lg` breakpoint. */
export function MobileNav({ footer }: MobileNavProps) {
  const pathname = usePathname()
  // Remember the route the drawer was opened on; a route change closes it
  // without needing a setState inside an effect.
  const [openedOn, setOpenedOn] = useState<string | null>(null)
  const open = openedOn === pathname
  const setOpen = (next: boolean) => setOpenedOn(next ? pathname : null)

  // Close on Escape.
  useEffect(() => {
    if (!open) return
    const onKey = (event: KeyboardEvent) => event.key === 'Escape' && setOpenedOn(null)
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [open])

  return (
    <div className="lg:hidden">
      <header className="sticky top-0 z-30 flex h-14 items-center justify-between border-b bg-background/80 px-4 backdrop-blur-md">
        <BrandMark />
        <Button
          variant="ghost"
          size="icon"
          aria-label="Open navigation"
          aria-expanded={open}
          aria-controls="mobile-drawer"
          onClick={() => setOpen(true)}
        >
          <Menu />
        </Button>
      </header>

      <div
        aria-hidden
        onClick={() => setOpen(false)}
        className={cn(
          'fixed inset-0 z-40 bg-black/60 backdrop-blur-sm transition-opacity',
          open ? 'opacity-100' : 'pointer-events-none opacity-0',
        )}
      />
      <aside
        id="mobile-drawer"
        aria-label="Navigation"
        inert={!open}
        className={cn(
          'fixed inset-y-0 left-0 z-50 flex w-72 flex-col gap-6 border-r bg-sidebar p-4 transition-transform duration-300 ease-out',
          open ? 'translate-x-0' : '-translate-x-full',
        )}
      >
        <div className="flex items-center justify-between">
          <BrandMark />
          <Button variant="ghost" size="icon" aria-label="Close navigation" onClick={() => setOpen(false)}>
            <X />
          </Button>
        </div>
        <div className="flex-1 overflow-y-auto">
          <SidebarNav onNavigate={() => setOpen(false)} />
        </div>
        {footer}
      </aside>
    </div>
  )
}
