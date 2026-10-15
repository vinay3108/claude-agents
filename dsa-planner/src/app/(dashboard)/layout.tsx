import { redirect } from 'next/navigation'
import { getCurrentUser } from '@/shared/utils/get-current-user'
import { AppShell } from '@/presentation/components/shell/AppShell'

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  let email = ''
  try {
    const user = await getCurrentUser()
    email = user.email
  } catch {
    redirect('/login')
  }

  return <AppShell email={email}>{children}</AppShell>
}
