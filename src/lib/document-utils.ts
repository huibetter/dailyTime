import type { RuntimeDocument } from '../data/runtime-storage';
import { editorStateToMarkdown, editorStateToTitle } from './editor-document';

export type DocumentInput = Partial<RuntimeDocument> & {
  id: string | number;
};

export function firstHeading(content: string | null | undefined): string {
  const match = String(content || '').match(/^#\s+(.+?)\s*$/m);
  return (match?.[1] || '')
    .replace(/!\[([^\]]*)\]\([^)]+\)/g, '$1')
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
    .replace(/[\*_`~]/g, '')
    .trim();
}

export function documentTitle(
  document: Pick<RuntimeDocument, 'content' | 'title'> & Partial<RuntimeDocument>,
): string {
  return (
    editorStateToTitle(document.editorState) ||
    firstHeading(document.content) ||
    document.title ||
    '未命名便笺'
  );
}

export function normalizeDocument(document: DocumentInput): RuntimeDocument {
  const content = typeof document.content === 'string' ? document.content : '';
  const normalized: RuntimeDocument = {
    ...document,
    id: document.id,
    project: document.project || '',
    title:
      editorStateToTitle(document.editorState) ||
      firstHeading(content) ||
      document.title ||
      '未命名便笺',
    content,
    updated: document.updated || '刚刚',
    planned: document.planned ?? null,
    plannedTime: document.plannedTime ?? null,
    status: document.status || '未开始',
    tags: Array.isArray(document.tags) ? document.tags : [],
    attachments: Array.isArray(document.attachments) ? document.attachments : [],
  };
  if (document.editorState) {
    normalized.editorState = document.editorState;
    normalized.contentFormat = document.contentFormat || 'tiptap-json';
  } else if (document.contentFormat) {
    normalized.contentFormat = document.contentFormat;
  }
  return normalized;
}

export function safeFileName(value: string | null | undefined): string {
  return (value || 'dailytime-export').replace(/[\\/:*?"<>|]/g, '-').trim() || 'dailytime-export';
}

export function documentMarkdown(
  document: RuntimeDocument,
  projectName: string | null | undefined,
): string {
  const meta = [
    `> 项目：${projectName || '未命名项目'}`,
    `> 计划：${document.planned || '未规划'}${document.plannedTime ? ` ${document.plannedTime}` : ''}`,
    `> 状态：${document.status || '未开始'}`,
    document.tags?.length ? `> 标签：${document.tags.join('、')}` : '',
  ].filter(Boolean);
  const attachments = document.attachments?.length
    ? `\n\n## 附件\n\n${document.attachments
        .map((item) => `- ${typeof item === 'string' ? item : item.originalName}`)
        .join('\n')}`
    : '';
  const content = document.editorState
    ? editorStateToMarkdown(document.editorState)
    : document.content;
  return `# ${documentTitle(document)}\n\n${meta.join('\n')}\n\n${content || ''}${attachments}\n`;
}
