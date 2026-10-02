export interface MonthCursor {
  year: number;
  month: number;
}

export function todayKey(date = new Date()): string {
  return date.toISOString().slice(0, 10);
}

export function formatDate(value: string | null | undefined): string {
  if (!value) return '未规划';
  const date = new Date(`${value}T12:00:00`);
  return `${date.getMonth() + 1} 月 ${date.getDate()} 日`;
}

export function addDays(value: string, amount: number): string {
  const date = new Date(`${value}T12:00:00`);
  date.setDate(date.getDate() + amount);
  return date.toISOString().slice(0, 10);
}

export function dayLabel(value: string | null | undefined, referenceDate = new Date()): string {
  if (!value) return '未规划';
  const today = todayKey(referenceDate);
  if (value === today) return '今天';
  if (value === addDays(today, 1)) return '明天';
  return formatDate(value);
}

export function currentSchedule(date = new Date()): { date: string; time: string } {
  return {
    date: todayKey(date),
    time: `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`,
  };
}

export function monthCursor(date = new Date()): MonthCursor {
  return { year: date.getFullYear(), month: date.getMonth() };
}
