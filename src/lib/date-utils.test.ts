import { describe, expect, it } from 'vitest';
import { addDays, currentSchedule, dayLabel, formatDate, monthCursor } from './date-utils';

describe('date utilities', () => {
  it('formats dates without timezone drift', () => {
    expect(formatDate('2026-10-03')).toBe('10 月 3 日');
    expect(addDays('2026-10-03', 1)).toBe('2026-10-04');
  });

  it('labels relative schedule dates', () => {
    const reference = new Date('2026-10-03T09:05:00');
    expect(dayLabel('2026-10-03', reference)).toBe('今天');
    expect(dayLabel('2026-10-04', reference)).toBe('明天');
  });

  it('creates deterministic schedule and month values', () => {
    const date = new Date('2026-10-03T09:05:00');
    expect(currentSchedule(date)).toEqual({ date: '2026-10-03', time: '09:05' });
    expect(monthCursor(date)).toEqual({ year: 2026, month: 9 });
  });
});
