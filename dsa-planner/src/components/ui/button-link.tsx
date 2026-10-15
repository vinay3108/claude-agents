import Link from 'next/link'
import type { VariantProps } from 'class-variance-authority'
import { buttonVariants } from '@/components/ui/button'
import { cn } from '@/lib/utils'

type ButtonLinkProps = React.ComponentProps<typeof Link> &
  VariantProps<typeof buttonVariants> & {
    /** Use a plain <a> (full page load), e.g. for OAuth redirects that leave the app. */
    readonly external?: boolean
  }

/**
 * A real link that looks like a button. Base UI's Button would put
 * role="button" on an <a>, so screen readers would announce navigation as a
 * button action; this keeps link semantics.
 */
export function ButtonLink({ className, variant, size, external = false, href, ...props }: ButtonLinkProps) {
  const classes = cn(buttonVariants({ variant, size }), className)
  if (external) {
    return <a href={typeof href === 'string' ? href : href.toString()} className={classes} {...props} />
  }
  return <Link href={href} className={classes} {...props} />
}
