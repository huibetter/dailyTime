export type DocumentStatus = '未开始' | '进行中' | '已完成';

export interface Workspace {
  id: string;
  name: string;
  displayName: string;
  createdAt: string;
  updatedAt: string;
}

export interface Project {
  id: string;
  workspaceId: string;
  name: string;
  color: string;
  createdAt: string;
  updatedAt: string;
}

export interface ProjectDocument {
  id: string;
  projectId: string;
  title: string;
  content: string;
  plannedDate: string | null;
  plannedTime: string | null;
  status: DocumentStatus;
  createdAt: string;
  updatedAt: string;
}

export interface Tag {
  id: string;
  name: string;
  createdAt: string;
}

export interface Attachment {
  id: string;
  documentId: string;
  originalName: string;
  relativePath: string;
  mimeType: string | null;
  sizeBytes: number;
  createdAt: string;
}

export interface AppSettings {
  displayName: string;
  currentWorkspaceId: string;
  theme: 'light' | 'system' | 'dark';
  compactMode: boolean;
  sidebarCollapsed: boolean;
  timelineWidth: number;
}

export interface Repository<T, CreateInput, UpdateInput> {
  list(): Promise<T[]>;
  getById(id: string): Promise<T | null>;
  create(input: CreateInput): Promise<T>;
  update(id: string, input: UpdateInput): Promise<T>;
  delete(id: string): Promise<void>;
}
