import { describe, expect, it } from 'vitest'
import { linkedinCallbackNotice } from '@/presentation/components/settings/linkedinNotice'

describe('linkedinCallbackNotice', () => {
  it('maps the success code to a success notice', () => {
    expect(linkedinCallbackNotice('connected')).toEqual({ type: 'success', text: 'LinkedIn connected.' })
  })

  it('maps known failure codes to error notices', () => {
    expect(linkedinCallbackNotice('cancelled')?.type).toBe('error')
    expect(linkedinCallbackNotice('taken')?.text).toMatch(/another account/)
    expect(linkedinCallbackNotice('expired')?.text).toMatch(/try again/i)
  })

  it('ignores a missing or unknown code', () => {
    expect(linkedinCallbackNotice(null)).toBeNull()
    expect(linkedinCallbackNotice('<script>')).toBeNull()
    expect(linkedinCallbackNotice('toString')).toBeNull()
  })
})
