import type {
  RuntimeDocument,
  RuntimeProject,
  RuntimeSettings,
  RuntimeState,
} from '../data/runtime-storage';
import { normalizeDocument } from './document-utils';

export const BACKUP_FORMAT = 'dailytime';
export const BACKUP_FORMAT_VERSION = 2;

export interface BackupPreferences {
  theme: 'light' | 'system' | 'dark';
  compact: boolean;
  sidebarCollapsed: boolean;
  timelineWidth: number;
}

export interface BackupSnapshot {
  projects: RuntimeProject[];
  docs: RuntimeDocument[];
  profile: RuntimeSettings;
  preferences: BackupPreferences;
}

export interface BackupEnvelope {
  format: typeof BACKUP_FORMAT;
  formatVersion: number;
  appVersion: string;
  createdAt: string;
  data: BackupSnapshot;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function isProject(value: unknown): value is RuntimeProject {
  return (
    isRecord(value) &&
    typeof value.id === 'string' &&
    typeof value.name === 'string' &&
    typeof value.color === 'string'
  );
}

function isProfile(value: unknown): value is RuntimeSettings {
  return (
    isRecord(value) &&
    typeof value.name === 'string' &&
    typeof value.workspace === 'string' &&
    typeof value.avatar === 'string'
  );
}

function isPreferences(value: unknown): value is BackupPreferences {
  return (
    isRecord(value) &&
    (value.theme === 'light' || value.theme === 'system' || value.theme === 'dark') &&
    typeof value.compact === 'boolean' &&
    typeof value.sidebarCollapsed === 'boolean' &&
    typeof value.timelineWidth === 'number' &&
    Number.isFinite(value.timelineWidth)
  );
}

function validateEnvelope(value: unknown): asserts value is BackupEnvelope {
  if (
    !isRecord(value) ||
    value.format !== BACKUP_FORMAT ||
    ![1, BACKUP_FORMAT_VERSION].includes(value.formatVersion as number) ||
    typeof value.appVersion !== 'string' ||
    typeof value.createdAt !== 'string' ||
    !isRecord(value.data) ||
    !Array.isArray(value.data.projects) ||
    !value.data.projects.every(isProject) ||
    !Array.isArray(value.data.docs) ||
    !value.data.docs.every(
      (document) => isRecord(document) && typeof document.id !== 'undefined',
    ) ||
    !isProfile(value.data.profile) ||
    !isPreferences(value.data.preferences)
  ) {
    throw new Error('备份文件格式无效或版本不受支持');
  }
}

export function createBackupEnvelope(
  snapshot: BackupSnapshot,
  appVersion: string,
  createdAt = new Date().toISOString(),
): BackupEnvelope {
  return {
    format: BACKUP_FORMAT,
    formatVersion: BACKUP_FORMAT_VERSION,
    appVersion,
    createdAt,
    data: snapshot,
  };
}

export function serializeBackup(snapshot: BackupSnapshot, appVersion: string): string {
  return JSON.stringify(createBackupEnvelope(snapshot, appVersion), null, 2);
}

export function parseBackup(raw: string): BackupEnvelope {
  let value: unknown;
  try {
    value = JSON.parse(raw);
  } catch {
    throw new Error('备份文件不是有效的 JSON');
  }
  validateEnvelope(value);
  const projectIds = new Set(value.data.projects.map((project) => project.id));
  const docs = value.data.docs.map((document) => normalizeDocument(document as never));
  if (docs.some((document) => !projectIds.has(document.project))) {
    throw new Error('备份文件包含找不到所属项目的文档');
  }
  return {
    ...value,
    data: {
      ...value.data,
      docs,
    },
  };
}

export function backupToState(envelope: BackupEnvelope): RuntimeState {
  return {
    projects: envelope.data.projects,
    docs: envelope.data.docs,
  };
}
