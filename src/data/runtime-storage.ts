import { isTauri } from '@tauri-apps/api/core';
import { openDatabase } from './database';

export interface RuntimeProject {
  id: string;
  name: string;
  color: string;
}

export interface RuntimeDocument {
  id: string | number;
  project: string;
  title: string;
  content: string;
  updated: string;
  planned: string | null;
  plannedTime: string | null;
  status: '未开始' | '进行中' | '已完成';
  tags: string[];
  attachments: string[];
}

export interface RuntimeState {
  projects: RuntimeProject[];
  docs: RuntimeDocument[];
}

interface ProjectRow {
  id: string;
  name: string;
  color: string;
}

interface DocumentRow {
  id: string;
  project_id: string;
  title: string;
  content: string;
  planned_date: string | null;
  planned_time: string | null;
  status: RuntimeDocument['status'];
  updated_at: string;
}

interface TagRow {
  document_id: string;
  name: string;
}

const DESKTOP = isTauri();

function now(): string {
  return new Date().toISOString();
}

function newId(): string {
  return globalThis.crypto?.randomUUID?.() ?? `dt-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function formatUpdated(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '刚刚';
  return date.toLocaleString('zh-CN', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' });
}

export function isDesktopStorage(): boolean {
  return DESKTOP;
}

export async function loadDesktopState(): Promise<RuntimeState> {
  if (!DESKTOP) return { projects: [], docs: [] };

  const db = await openDatabase();
  const workspaces = await db.select<{ id: string }[]>('SELECT id FROM workspaces ORDER BY created_at LIMIT 1');
  let workspaceId = workspaces[0]?.id;

  if (!workspaceId) {
    workspaceId = newId();
    const timestamp = now();
    await db.execute(
      'INSERT INTO workspaces (id, name, display_name, created_at, updated_at) VALUES ($1, $2, $3, $4, $5)',
      [workspaceId, '我的工作空间', '我的工作空间', timestamp, timestamp],
    );
    await db.execute(
      'INSERT INTO projects (id, workspace_id, name, color, created_at, updated_at) VALUES ($1, $2, $3, $4, $5, $6)',
      ['product', workspaceId, '产品迭代', '#5f9d95', timestamp, timestamp],
    );
  }

  const projects = await db.select<ProjectRow[]>(
    'SELECT id, name, color FROM projects WHERE workspace_id = $1 ORDER BY created_at',
    [workspaceId],
  );
  const documents = await db.select<DocumentRow[]>(
    'SELECT id, project_id, title, content, planned_date, planned_time, status, updated_at FROM documents ORDER BY planned_date DESC, planned_time DESC',
  );
  const tags = await db.select<TagRow[]>(
    'SELECT document_tags.document_id, tags.name FROM document_tags JOIN tags ON tags.id = document_tags.tag_id',
  );
  const tagsByDocument = new Map<string, string[]>();
  for (const tag of tags) tagsByDocument.set(tag.document_id, [...(tagsByDocument.get(tag.document_id) ?? []), tag.name]);

  return {
    projects,
    docs: documents.map((document) => ({
      id: document.id,
      project: document.project_id,
      title: document.title,
      content: document.content,
      updated: formatUpdated(document.updated_at),
      planned: document.planned_date,
      plannedTime: document.planned_time,
      status: document.status,
      tags: tagsByDocument.get(document.id) ?? [],
      attachments: [],
    })),
  };
}

export async function saveDesktopProjects(projects: RuntimeProject[]): Promise<void> {
  if (!DESKTOP) return;
  const db = await openDatabase();
  const workspace = await db.select<{ id: string }[]>('SELECT id FROM workspaces ORDER BY created_at LIMIT 1');
  if (!workspace[0]) return;
  const timestamp = now();
  for (const project of projects) {
    await db.execute(
      `INSERT INTO projects (id, workspace_id, name, color, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6)
       ON CONFLICT(id) DO UPDATE SET name = excluded.name, color = excluded.color, updated_at = excluded.updated_at`,
      [project.id, workspace[0].id, project.name, project.color, timestamp, timestamp],
    );
  }
}

export async function saveDesktopDocuments(docs: RuntimeDocument[]): Promise<void> {
  if (!DESKTOP) return;
  const db = await openDatabase();
  const existing = await db.select<{ id: string }[]>('SELECT id FROM documents');
  const nextIds = new Set(docs.map((document) => String(document.id)));
  for (const row of existing) {
    if (!nextIds.has(row.id)) await db.execute('DELETE FROM documents WHERE id = $1', [row.id]);
  }

  const timestamp = now();
  for (const document of docs) {
    const id = String(document.id);
    await db.execute(
      `INSERT INTO documents (id, project_id, title, content, planned_date, planned_time, status, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
       ON CONFLICT(id) DO UPDATE SET project_id = excluded.project_id, title = excluded.title,
       content = excluded.content, planned_date = excluded.planned_date, planned_time = excluded.planned_time,
       status = excluded.status, updated_at = excluded.updated_at`,
      [id, document.project, document.title, document.content, document.planned, document.plannedTime, document.status, timestamp, timestamp],
    );
    await db.execute('DELETE FROM document_tags WHERE document_id = $1', [id]);
    for (const tagName of document.tags ?? []) {
      const tagId = newId();
      await db.execute(
        'INSERT INTO tags (id, name, created_at) VALUES ($1, $2, $3) ON CONFLICT(name) DO NOTHING',
        [tagId, tagName, timestamp],
      );
      const tag = await db.select<{ id: string }[]>('SELECT id FROM tags WHERE name = $1 LIMIT 1', [tagName]);
      if (tag[0]) await db.execute('INSERT OR IGNORE INTO document_tags (document_id, tag_id) VALUES ($1, $2)', [id, tag[0].id]);
    }
  }
}
