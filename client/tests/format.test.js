import { describe, it, expect } from 'vitest'
import { todayIso } from '../src/lib/format'

describe('todayIso', () => {
  it('uses the local calendar date, not the UTC date', () => {
    // 02:07 local time on 8 Nov: in UTC+5:30 this instant is still 7 Nov in UTC.
    const lateNight = new Date(2026, 10, 8, 2, 7)
    expect(todayIso(lateNight)).toBe('2026-11-08')
    expect(todayIso(new Date(2026, 0, 5, 23, 59))).toBe('2026-01-05')
  })
})
