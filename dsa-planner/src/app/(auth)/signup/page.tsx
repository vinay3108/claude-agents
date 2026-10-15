import { AuthForm } from '@/presentation/components/auth/AuthForm'
import { AuthLayout } from '@/presentation/components/auth/AuthLayout'

export default function SignupPage() {
  return (
    <AuthLayout
      eyebrow="// create account"
      title="Start your streak"
      description="Connect LeetCode, find your gaps, and practice with an AI coach."
    >
      <AuthForm mode="signup" />
    </AuthLayout>
  )
}
