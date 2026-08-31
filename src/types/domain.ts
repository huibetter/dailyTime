export type DocumentStatus = '未开始' | '进行中' | '已完成';

export interface Project {
  id: string;
  name: string;
  color: string;
  createdAt: string;
  updatedAt: string;
}

export interface Attachment {
  id: string;
  documentId: string;
  originalName: string;
  storedName: string;
  relativePath: string;
  mimeType: string;
  size: number;
  createdAt: string;
  kind: 'attachment' | 'image';
}

export interface DocumentItem {
  id: string;
  projectId: string;
  title: string;
  content: string;
  plannedDate: string | null;
  plannedTime: string | null;
  status: DocumentStatus;
  tags: string[];
  attachments: Attachment[];
  createdAt: string;
  updatedAt: string;
}

export interface WorkspaceSnapshot {
  projects: Project[];
  documents: DocumentItem[];
}

export interface BackupManifest {
  app: 'DailyTime';
  formatVersion: 1;
  databaseVersion: number;
  exportedAt: string;
  attachmentCount: number;
  checksums: Record<string, string>;
}
