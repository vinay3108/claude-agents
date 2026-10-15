import { describe, expect, it } from 'vitest'
import { readApiErrorMessage } from '@/presentation/components/auth/readApiError'

describe('readApiErrorMessage', () => {
  it('reads the message from the API error envelope', () => {
    const body = { success: false, error: { code: 'VALIDATION_ERROR', message: 'Invalid credentials' } }
    expect(readApiErrorMessage(body, 'Sign-in failed')).toBe('Invalid credentials')
  })

  it('accepts a plain string error', () => {
    expect(readApiErrorMessage({ error: 'Too many attempts' }, 'x')).toBe('Too many attempts')
  })

  it('falls back when the body has no usable message', () => {
    expect(readApiErrorMessage(null, 'Sign-in failed')).toBe('Sign-in failed')
    expect(readApiErrorMessage({ error: { code: 'X' } }, 'Sign-in failed')).toBe('Sign-in failed')
    expect(readApiErrorMessage({ error: { message: '   ' } }, 'Sign-in failed')).toBe('Sign-in failed')
    expect(readApiErrorMessage('<html>', 'Sign-in failed')).toBe('Sign-in failed')
  })
})
