import { invoke } from '@tauri-apps/api/core';
import type { Attachment, DocumentItem, DocumentStatus, Project, WorkspaceSnapshot } from '../types/domain';
import { seedDocuments, seedProjects } from '../data/seed';
import { currentSchedule, safeStoredFileName } from '../utils/domain';
import { createBackupZip, readBackupZip } from './backup';

const isTauri = () => typeof window !== 'undefined' && Boolean(window.__TAURI_INTERNALS__ || (window as Window & { __TAURI__?: unknown }).__TAURI__);

async function invokeCommand<T>(command: string, args?: Record<string, unknown>): Promise<T> {
  try { return await invoke<T>(command, args); }
  catch (cause) {
    const message = typeof cause === 'string' ? cause : cause instanceof Error ? cause.message : JSON.stringify(cause);
    throw new Error(`本地数据库操作失败（${command}）：${message}`);
  }
}

function normalizeProject(value: Record<string, unknown>): Project {
  const now = new Date().toISOString();
  return { id: String(value.id ?? ''), name: String(value.name ?? '未命名项目'), color: String(value.color ?? '#8ca69b'), createdAt: String(value.createdAt ?? value.created_at ?? now), updatedAt: String(value.updatedAt ?? value.updated_at ?? now) };
}

function normalizeAttachment(value: Record<string, unknown>): Attachment {
  return { id: String(value.id ?? crypto.randomUUID()), documentId: String(value.documentId ?? value.document_id ?? ''), originalName: String(value.originalName ?? value.original_name ?? '未命名附件'), storedName: String(value.storedName ?? value.stored_name ?? ''), relativePath: String(value.relativePath ?? value.relative_path ?? ''), mimeType: String(value.mimeType ?? value.mime_type ?? 'application/octet-stream'), size: Number(value.size ?? 0), createdAt: String(value.createdAt ?? value.created_at ?? new Date().toISOString()), kind: value.kind === 'image' ? 'image' : 'attachment' };
}

function normalizeDocument(value: Record<string, unknown>): DocumentItem {
  const now = new Date().toISOString();
  const tags = Array.isArray(value.tags) ? value.tags.map(String) : [];
  const attachments = Array.isArray(value.attachments) ? value.attachments.map((item) => normalizeAttachment((item ?? {}) as Record<string, unknown>)) : [];
  const status = value.status === '进行中' || value.status === '已完成' ? value.status : '未开始';
  return { id: String(value.id ?? ''), projectId: String(value.projectId ?? value.project_id ?? ''), title: String(value.title ?? '未命名便笺'), content: String(value.content ?? ''), plannedDate: (value.plannedDate ?? value.planned_date ?? null) as string | null, plannedTime: (value.plannedTime ?? value.planned_time ?? null) as string | null, status, tags, attachments, createdAt: String(value.createdAt ?? value.created_at ?? now), updatedAt: String(value.updatedAt ?? value.updated_at ?? now) };
}

function normalizeList<T>(value: unknown, mapper: (item: Record<string, unknown>) => T): T[] {
  return Array.isArray(value) ? value.map((item) => mapper((item ?? {}) as Record<string, unknown>)) : [];
}
const delay = () => new Promise((resolve) => setTimeout(resolve, 60));

type StoredState = WorkspaceSnapshot;

const storageKey = 'dailytime-web-fallback-v1';

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function normalizeState(value?: Partial<StoredState> | null): StoredState {
  const projects = Array.isArray(value?.projects) && value.projects.length ? value.projects : seedProjects;
  const documents = Array.isArray(value?.documents) && value.documents.length ? value.documents : seedDocuments;
  return { projects: clone(projects), documents: clone(documents) };
}

class WebFallbackStore {
  private state: StoredState;

  constructor() {
    try {
      this.state = normalizeState(JSON.parse(localStorage.getItem(storageKey) || 'null'));
    } catch {
      this.state = normalizeState();
    }
    this.persist();
  }

  replace(snapshot: WorkspaceSnapshot) {
    this.state = clone(snapshot);
    this.persist();
  }

  private persist() {
    localStorage.setItem(storageKey, JSON.stringify(this.state));
  }

  async snapshot() {
    await delay();
    return clone(this.state);
  }

  async createProject(name: string) {
    const now = new Date().toISOString();
    const project: Project = { id: crypto.randomUUID(), name, color: '#8ca69b', createdAt: now, updatedAt: now };
    this.state.projects.push(project);
    this.persist();
    return clone(project);
  }

  async updateProject(id: string, patch: Partial<Pick<Project, 'name' | 'color'>>) {
    const now = new Date().toISOString();
    this.state.projects = this.state.projects.map((project) => (project.id === id ? { ...project, ...patch, updatedAt: now } : project));
    this.persist();
    return clone(this.state.projects.find((project) => project.id === id)!);
  }

  async createDocument(projectId: string) {
    const now = new Date().toISOString();
    const schedule = currentSchedule();
    const doc: DocumentItem = {
      id: crypto.randomUUID(),
      projectId,
      title: '未命名便笺',
      content: '# 未命名便笺\n\n开始记录这项工作的背景、思考和下一步。\n\n## 下一步\n\n- [ ] ',
      plannedDate: schedule.date,
      plannedTime: schedule.time,
      status: '未开始',
      tags: [],
      attachments: [],
      createdAt: now,
      updatedAt: now,
    };
    this.state.documents.unshift(doc);
    this.persist();
    return clone(doc);
  }

  async updateDocument(id: string, patch: Partial<Omit<DocumentItem, 'id' | 'createdAt' | 'attachments'>>) {
    const now = new Date().toISOString();
    this.state.documents = this.state.documents.map((doc) => (doc.id === id ? { ...doc, ...patch, updatedAt: now } : doc));
    this.persist();
    return clone(this.state.documents.find((doc) => doc.id === id)!);
  }

  async deleteDocument(id: string) {
    this.state.documents = this.state.documents.filter((doc) => doc.id !== id);
    this.persist();
  }

  async addAttachment(documentId: string, file: File, kind: Attachment['kind']) {
    const now = new Date().toISOString();
    const attachment: Attachment = {
      id: crypto.randomUUID(),
      documentId,
      originalName: file.name || 'pasted-image.png',
      storedName: safeStoredFileName(file.name || 'pasted-image.png'),
      relativePath: '',
      mimeType: file.type || 'application/octet-stream',
      size: file.size,
      createdAt: now,
      kind,
    };
    if (kind === 'image') {
      attachment.relativePath = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result));
        reader.onerror = () => reject(new Error('图片读取失败'));
        reader.readAsDataURL(file);
      });
    } else {
      attachment.relativePath = `local://${attachment.storedName}`;
    }
    this.state.documents = this.state.documents.map((doc) => (doc.id === documentId ? { ...doc, attachments: [...doc.attachments, attachment], updatedAt: now } : doc));
    this.persist();
    return clone(attachment);
  }

  async exportBackup() {
    const blob = new Blob([createBackupZip(this.state)], { type: 'application/zip' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `dailytime-backup-${new Date().toISOString().slice(0, 10)}.zip`;
    a.click();
    URL.revokeObjectURL(url);
  }
}

const fallback = new WebFallbackStore();

export const projectRepository = {
  async list(): Promise<Project[]> {
    if (isTauri()) return normalizeList(await invokeCommand<unknown>('list_projects'), normalizeProject);
    return (await fallback.snapshot()).projects;
  },
  async create(name: string): Promise<Project> {
    if (isTauri()) return normalizeProject(await invokeCommand<Record<string, unknown>>('create_project', { name }));
    return fallback.createProject(name);
  },
  async update(id: string, patch: Partial<Pick<Project, 'name' | 'color'>>): Promise<Project> {
    if (isTauri()) return normalizeProject(await invokeCommand<Record<string, unknown>>('update_project', { id, patch }));
    return fallback.updateProject(id, patch);
  },
};

export const documentRepository = {
  async list(): Promise<DocumentItem[]> {
    if (isTauri()) return normalizeList(await invokeCommand<unknown>('list_documents'), normalizeDocument);
    return (await fallback.snapshot()).documents;
  },
  async create(projectId: string): Promise<DocumentItem> {
    if (isTauri()) return normalizeDocument(await invokeCommand<Record<string, unknown>>('create_document', { projectId }));
    return fallback.createDocument(projectId);
  },
  async update(id: string, patch: Partial<Omit<DocumentItem, 'id' | 'createdAt' | 'attachments'>>): Promise<DocumentItem> {
    if (isTauri()) return normalizeDocument(await invokeCommand<Record<string, unknown>>('update_document', { id, patch }));
    return fallback.updateDocument(id, patch);
  },
  async delete(id: string): Promise<void> {
    if (isTauri()) return invokeCommand('delete_document', { id });
    return fallback.deleteDocument(id);
  },
};

export const attachmentRepository = {
  async add(documentId: string, file: File, kind: Attachment['kind']): Promise<Attachment> {
    if (isTauri()) {
      const bytes = Array.from(new Uint8Array(await file.arrayBuffer()));
      return normalizeAttachment(await invokeCommand<Record<string, unknown>>('add_attachment', { documentId, originalName: file.name || 'pasted-image.png', mimeType: file.type || 'application/octet-stream', bytes, kind }));
    }
    return fallback.addAttachment(documentId, file, kind);
  },
};

export const backupRepository = {
  async export(): Promise<void> {
    if (isTauri()) return invokeCommand('export_backup');
    return fallback.exportBackup();
  },
  async import(): Promise<void> {
    if (isTauri()) return invokeCommand('import_backup');
    throw new Error('浏览器预览模式暂不支持导入备份');
  },
};



