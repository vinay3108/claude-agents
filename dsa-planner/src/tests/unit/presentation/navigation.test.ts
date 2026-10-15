import { describe, expect, it } from 'vitest'
import { NAV_SECTIONS, isNavItemActive } from '@/presentation/components/shell/navigation'

describe('isNavItemActive', () => {
  it('matches the exact route and nested routes', () => {
    expect(isNavItemActive('/interview', '/interview')).toBe(true)
    expect(isNavItemActive('/interview/abc-123', '/interview')).toBe(true)
  })

  it('does not match a route that only shares a prefix', () => {
    expect(isNavItemActive('/interviews', '/interview')).toBe(false)
    expect(isNavItemActive('/dashboard', '/interview')).toBe(false)
  })

  it('ignores a trailing slash', () => {
    expect(isNavItemActive('/notes/', '/notes')).toBe(true)
  })
})

describe('NAV_SECTIONS', () => {
  const items = NAV_SECTIONS.flatMap((s) => s.items)

  it('lists every dashboard route exactly once', () => {
    expect(items.map((i) => i.href).sort()).toEqual([
      '/coach',
      '/dashboard',
      '/interview',
      '/notes',
      '/recommendations',
      '/settings',
      '/system-design',
    ])
  })

  it('gives every item a label and an icon', () => {
    for (const item of items) {
      expect(item.label.length).toBeGreaterThan(0)
      expect(item.icon).toBeDefined()
    }
  })
})
