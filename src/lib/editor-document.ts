import { generateJSON, type JSONContent } from '@tiptap/core';
import { renderMarkdown } from './markdown';
import { createStructuredEditorExtensions } from './structured-editor';

export const EDITOR_DOCUMENT_VERSION = 1;

export interface EditorDocumentState {
  type: 'doc';
  version: number;
  content?: JSONContent[];
}

export function markdownToEditorHtml(markdown: string): string {
  const source = (markdown || '').replace(
    /(!\[[^\]]*\]\()dt-resource:([^\s)]+)(\))/g,
    '$1https://dailytime.invalid/resources/$2$3',
  );
  const html = renderMarkdown(source);
  if (typeof document === 'undefined') return html;
  const container = document.createElement('div');
  container.innerHTML = html;
  container.querySelectorAll('ul').forEach((list) => {
    if (!list.querySelector('input[type="checkbox"]')) return;
    list.setAttribute('data-type', 'taskList');
    list.querySelectorAll(':scope > li').forEach((item) => {
      const checkbox = item.querySelector(':scope > input[type="checkbox"]');
      item.setAttribute('data-type', 'taskItem');
      item.setAttribute(
        'data-checked',
        checkbox instanceof HTMLInputElement && checkbox.checked ? 'true' : 'false',
      );
      checkbox?.remove();
    });
  });
  const imageSources = [...(markdown || '').matchAll(/!\[[^\]]*\]\(([^)]+)\)/g)].map(
    (match) => match[1],
  );
  container.querySelectorAll('img').forEach((image, index) => {
    if (imageSources[index]) image.setAttribute('data-markdown-src', imageSources[index]);
  });
  container.querySelectorAll('table').forEach((table) => {
    const rows = [...table.querySelectorAll('tr')].map((row) =>
      [...row.querySelectorAll('th, td')].map((cell) => cell.textContent?.trim() || '').join(' | '),
    );
    const replacement = document.createElement('p');
    replacement.textContent = rows.join(' / ');
    table.replaceWith(replacement);
  });
  return container.innerHTML;
}

export function markdownToEditorState(markdown: string): EditorDocumentState {
  return {
    type: 'doc',
    version: EDITOR_DOCUMENT_VERSION,
    ...generateJSON(markdownToEditorHtml(markdown), createStructuredEditorExtensions()),
  };
}

function inline(node: JSONContent | undefined): string {
  if (!node) return '';
  if (node.type === 'text') {
    let value = node.text || '';
    for (const mark of node.marks || []) {
      if (mark.type === 'bold') value = `**${value}**`;
      if (mark.type === 'italic') value = `*${value}*`;
      if (mark.type === 'strike') value = `~~${value}~~`;
      if (mark.type === 'code') value = String.fromCharCode(96) + value + String.fromCharCode(96);
      if (mark.type === 'underline') value = `<u>${value}</u>`;
      if (mark.type === 'link') value = `[${value}](${mark.attrs?.href || ''})`;
    }
    return value;
  }
  if (node.type === 'image')
    return `![${node.attrs?.alt || ''}](${node.attrs?.markdownSrc || node.attrs?.src || ''})`;
  return (node.content || []).map((child) => inline(child)).join('');
}

function block(node: JSONContent | undefined, listIndex = 1): string {
  if (!node) return '';
  const children = node.content || [];
  const content = children.map((child) => inline(child)).join('');
  switch (node.type) {
    case 'paragraph':
      return content;
    case 'heading':
      return `${'#'.repeat(Number(node.attrs?.level || 1))} ${content}`;
    case 'blockquote':
      return children
        .map((child) => block(child))
        .join('\n')
        .split('\n')
        .map((line) => `> ${line}`)
        .join('\n');
    case 'bulletList':
      return children.map((child) => `- ${block(child)}`).join('\n');
    case 'orderedList':
      return children.map((child, index) => `${listIndex + index}. ${block(child)}`).join('\n');
    case 'taskList':
      return children
        .map((child) => `- [${child.attrs?.checked ? 'x' : ' '}] ${block(child)}`)
        .join('\n');
    case 'listItem':
    case 'taskItem':
      return children
        .map((child) => block(child))
        .filter(Boolean)
        .join('\n');
    case 'codeBlock':
      return `\`\`\`${node.attrs?.language || ''}\n${children.map((child) => child.text || '').join('')}\n\`\`\``;
    case 'horizontalRule':
      return '---';
    default:
      return (
        content ||
        children
          .map((child) => block(child))
          .filter(Boolean)
          .join('\n')
      );
  }
}

export function editorStateToMarkdown(
  state: EditorDocumentState | JSONContent | null | undefined,
): string {
  if (!state || state.type !== 'doc') return '';
  return (state.content || [])
    .map((node) => block(node))
    .filter(Boolean)
    .join('\n\n');
}

export function editorStateToPlainText(
  state: EditorDocumentState | JSONContent | null | undefined,
): string {
  return editorStateToMarkdown(state)
    .replace(/[*_~`>#\-[\]]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function editorStateToTitle(
  state: EditorDocumentState | JSONContent | null | undefined,
): string {
  const heading = state?.content?.find((node) => node.type === 'heading');
  return inline(heading)
    .replace(/[*_~`]/g, '')
    .trim();
}

export function normalizeEditorState(value: unknown): EditorDocumentState | null {
  if (!value || typeof value !== 'object') return null;
  const state = value as Partial<EditorDocumentState>;
  if (state.type !== 'doc' || !Array.isArray(state.content)) return null;
  return {
    type: 'doc',
    version: Number(state.version || EDITOR_DOCUMENT_VERSION),
    content: state.content,
  };
}
