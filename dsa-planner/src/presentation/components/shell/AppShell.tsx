import { BrandMark } from './BrandMark'
import { MobileNav } from './MobileNav'
import { SidebarNav } from './SidebarNav'
import { UserBadge } from './UserBadge'

interface AppShellProps {
  readonly email: string
  readonly children: React.ReactNode
}

/** Signed-in frame: fixed sidebar on desktop, top bar + drawer on mobile. */
export function AppShell({ email, children }: AppShellProps) {
  const user = <UserBadge email={email} />

  return (
    <div className="min-h-screen">
      <a
        href="#main"
        className="sr-only z-[60] rounded-md bg-primary px-3 py-2 text-primary-foreground focus:not-sr-only focus:fixed focus:top-3 focus:left-3"
      >
        Skip to content
      </a>

      <aside className="fixed inset-y-0 left-0 z-30 hidden w-64 flex-col gap-8 border-r bg-sidebar/85 px-4 py-5 backdrop-blur-md lg:flex">
        <div className="px-1">
          <BrandMark />
        </div>
        <div className="flex-1 overflow-y-auto">
          <SidebarNav />
        </div>
        {user}
      </aside>

      <MobileNav footer={user} />

      <main id="main" className="lg:pl-64">
        <div className="mx-auto w-full max-w-6xl px-4 py-6 sm:px-6 lg:px-10 lg:py-10">{children}</div>
      </main>
    </div>
  )
}
