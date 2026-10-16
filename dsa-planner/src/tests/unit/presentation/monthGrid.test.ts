import { describe, expect, it } from 'vitest'
import { buildMonthGrid, shiftMonth } from '@/presentation/utils/monthGrid'

describe('buildMonthGrid', () => {
  it('lays out October 2026 in Sunday-first weeks', () => {
    const weeks = buildMonthGrid(2026, 9)
    // 1 Oct 2026 is a Thursday.
    expect(weeks[0]).toEqual([null, null, null, null, '2026-10-01', '2026-10-02', '2026-10-03'])
    expect(weeks.at(-1)).toEqual(['2026-10-25', '2026-10-26', '2026-10-27', '2026-10-28', '2026-10-29', '2026-10-30', '2026-10-31'])
    expect(weeks).toHaveLength(5)
    expect(weeks.every((w) => w.length === 7)).toBe(true)
  })

  it('pads the last week of a month that ends mid-week', () => {
    // 30 Nov 2026 is a Monday.
    const last = buildMonthGrid(2026, 10).at(-1)!
    expect(last).toEqual(['2026-11-29', '2026-11-30', null, null, null, null, null])
  })

  it('handles February in a leap year', () => {
    const days = buildMonthGrid(2028, 1).flat().filter(Boolean)
    expect(days).toHaveLength(29)
    expect(days.at(-1)).toBe('2028-02-29')
  })
})

describe('shiftMonth', () => {
  it('moves across year boundaries', () => {
    expect(shiftMonth({ year: 2026, month: 0 }, -1)).toEqual({ year: 2025, month: 11 })
    expect(shiftMonth({ year: 2026, month: 11 }, 1)).toEqual({ year: 2027, month: 0 })
    expect(shiftMonth({ year: 2026, month: 9 }, 1)).toEqual({ year: 2026, month: 10 })
  })
})
