import { PageHeader } from '@/presentation/components/layout/PageHeader'
import { LeetCodeSettingsCard } from '@/presentation/components/settings/LeetCodeSettingsCard'
import { LinkedInSettingsCard } from '@/presentation/components/settings/LinkedInSettingsCard'
import { linkedinCallbackNotice } from '@/presentation/components/settings/linkedinNotice'

export default async function SettingsPage({ searchParams }: PageProps<'/settings'>) {
  const { linkedin } = await searchParams
  const notice = linkedinCallbackNotice(typeof linkedin === 'string' ? linkedin : null)

  return (
    <div className="max-w-2xl space-y-6">
      <PageHeader
        eyebrow="// account"
        title="Settings"
        description="Connect your accounts and keep your data in sync."
      />
      <LeetCodeSettingsCard index={1} />
      <LinkedInSettingsCard index={2} callbackNotice={notice} />
    </div>
  )
}
