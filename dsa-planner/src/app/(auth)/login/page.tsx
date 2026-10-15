import { AuthForm } from '@/presentation/components/auth/AuthForm'
import { AuthLayout } from '@/presentation/components/auth/AuthLayout'

export default function LoginPage() {
  return (
    <AuthLayout
      eyebrow="// sign in"
      title="Welcome back"
      description="Pick up where you left off. Your progress is waiting."
    >
      <AuthForm mode="signin" />
    </AuthLayout>
  )
}
