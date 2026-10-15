'use client'
import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { ArrowRight } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { readApiErrorMessage } from './readApiError'

type AuthMode = 'signin' | 'signup'

const MODE_CONFIG = {
  signin: {
    endpoint: '/api/auth/signin',
    submit: 'Sign in',
    pending: 'Signing in…',
    fallbackError: 'Sign-in failed',
    redirectTo: '/dashboard',
    passwordAutoComplete: 'current-password',
    switchText: 'No account?',
    switchLabel: 'Create one',
    switchHref: '/signup',
  },
  signup: {
    endpoint: '/api/auth/signup',
    submit: 'Create account',
    pending: 'Creating account…',
    fallbackError: 'Sign-up failed',
    redirectTo: '/login',
    passwordAutoComplete: 'new-password',
    switchText: 'Have an account?',
    switchLabel: 'Sign in',
    switchHref: '/login',
  },
} as const

const MIN_SIGNUP_PASSWORD = 8

interface AuthFormProps {
  readonly mode: AuthMode
}

/** Email + password form shared by the sign-in and sign-up pages. */
export function AuthForm({ mode }: AuthFormProps) {
  const config = MODE_CONFIG[mode]
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault()
    setLoading(true)
    setError(null)

    try {
      const res = await fetch(config.endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      })
      if (!res.ok) {
        const body: unknown = await res.json().catch(() => null)
        setError(readApiErrorMessage(body, config.fallbackError))
        setLoading(false)
        return
      }
      router.push(config.redirectTo)
    } catch {
      setError('Network error. Check your connection and try again.')
      setLoading(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5" noValidate={false}>
      <div className="space-y-2">
        <Label htmlFor="email">Email</Label>
        <Input
          id="email"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
          autoComplete="email"
          placeholder="you@example.com"
          className="h-11"
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="password">Password</Label>
        <Input
          id="password"
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
          minLength={mode === 'signup' ? MIN_SIGNUP_PASSWORD : undefined}
          autoComplete={config.passwordAutoComplete}
          aria-describedby={mode === 'signup' ? 'password-hint' : undefined}
          className="h-11"
        />
        {mode === 'signup' && (
          <p id="password-hint" className="text-xs text-muted-foreground">
            At least {MIN_SIGNUP_PASSWORD} characters.
          </p>
        )}
      </div>

      {error && (
        <p role="alert" className="rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {error}
        </p>
      )}

      <Button type="submit" className="h-11 w-full text-sm" disabled={loading}>
        {loading ? config.pending : config.submit}
        {!loading && <ArrowRight />}
      </Button>

      <p className="text-center text-sm text-muted-foreground">
        {config.switchText}{' '}
        <Link href={config.switchHref} className="font-medium text-primary underline-offset-4 hover:underline">
          {config.switchLabel}
        </Link>
      </p>
    </form>
  )
}
