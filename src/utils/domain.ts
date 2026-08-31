import type { BackupManifest, DocumentItem } from '../types/domain';

export const todayIso = () => new Date().toISOString().slice(0, 10);

export function currentSchedule() {
  const now = new Date();
  const date = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
  const time = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
  return { date, time };
}

export function addDays(value: string, days: number) {
  const date = new Date(`${value}T12:00:00`);
  date.setDate(date.getDate() + days);
  return date.toISOString().slice(0, 10);
}

export function formatDate(value?: string | null) {
  if (!value) return '未规划';
  const date = new Date(`${value}T12:00:00`);
  return `${date.getMonth() + 1} 月 ${date.getDate()} 日`;
}

export function dayLabel(value?: string | null, today = todayIso()) {
  if (!value) return '未规划';
  if (value === today) return '今天';
  if (value === addDays(today, 1)) return '明天';
  return formatDate(value);
}

export function displayUpdated(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  const today = new Date(`${todayIso()}T00:00:00`);
  const thatDay = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const delta = Math.round((today.getTime() - thatDay.getTime()) / 86400000);
  const time = `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
  if (delta === 0) return `今天 ${time}`;
  if (delta === 1) return `昨天 ${time}`;
  return `${date.getMonth() + 1} 月 ${date.getDate()} 日`;
}

export function sortDocumentsByPlan(documents: DocumentItem[]) {
  return [...documents].sort((a, b) => {
    const ap = `${a.plannedDate ?? '0000-00-00'} ${a.plannedTime ?? '00:00'}`;
    const bp = `${b.plannedDate ?? '0000-00-00'} ${b.plannedTime ?? '00:00'}`;
    return bp.localeCompare(ap);
  });
}

export function nextAction(documents: DocumentItem[]) {
  return [...documents]
    .filter((doc) => doc.status !== '已完成' && doc.plannedDate)
    .sort((a, b) => `${a.plannedDate} ${a.plannedTime ?? '23:59'}`.localeCompare(`${b.plannedDate} ${b.plannedTime ?? '23:59'}`))[0];
}

export function safeStoredFileName(originalName: string, id: string = crypto.randomUUID()) {
  const clean = originalName.replace(/[\\/:*?"<>|]+/g, '-').replace(/\s+/g, ' ').trim() || 'attachment';
  return `${id}-${clean}`;
}

export function validateBackupManifest(value: unknown): value is BackupManifest {
  if (!value || typeof value !== 'object') return false;
  const manifest = value as BackupManifest;
  return manifest.app === 'DailyTime' && manifest.formatVersion === 1 && typeof manifest.exportedAt === 'string' && Number.isInteger(manifest.attachmentCount) && manifest.attachmentCount >= 0;
}

export function isSafeZipPath(path: string) {
  const normalized = path.replace(/\\/g, '/');
  return !!normalized && !normalized.startsWith('/') && !normalized.includes('../') && !normalized.startsWith('..') && !/^[a-zA-Z]:/.test(normalized);
}

