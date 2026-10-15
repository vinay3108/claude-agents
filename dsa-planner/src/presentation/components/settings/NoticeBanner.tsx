import { cn } from '@/lib/utils'
import type { Notice } from './linkedinNotice'

export function NoticeBanner({ notice }: { readonly notice: Notice }) {
  return (
    <p
      role={notice.type === 'error' ? 'alert' : 'status'}
      className={cn(
        'rounded-lg border px-3 py-2 text-sm',
        notice.type === 'error'
          ? 'border-destructive/30 bg-destructive/10 text-destructive'
          : 'border-easy/30 bg-easy/10 text-easy',
      )}
    >
      {notice.text}
    </p>
  )
}
