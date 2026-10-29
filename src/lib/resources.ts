import { convertFileSrc, isTauri } from '@tauri-apps/api/core';
import { appDataDir, join } from '@tauri-apps/api/path';
import { BaseDirectory, mkdir, remove, writeFile } from '@tauri-apps/plugin-fs';

export interface LocalResource {
  id: string;
  originalName: string;
  relativePath: string;
  mimeType: string | null;
  sizeBytes: number;
  createdAt: string;
}

function resourceId(): string {
  return (
    globalThis.crypto?.randomUUID?.() ??
    `resource-${Date.now()}-${Math.random().toString(16).slice(2)}`
  );
}

export function resourceFileName(id: string, originalName: string): string {
  const extension = originalName.includes('.') ? originalName.split('.').pop() : '';
  const safeExtension = extension?.replace(/[^a-z0-9]/gi, '').slice(0, 12);
  return `${id}${safeExtension ? `.${safeExtension}` : ''}`;
}

export function resourceRelativePath(
  documentId: string | number,
  id: string,
  name: string,
): string {
  const safeDocumentId = String(documentId).replace(/[^a-zA-Z0-9_-]/g, '_');
  return `resources/${safeDocumentId}/${resourceFileName(id, name)}`;
}

export function isLocalResourceSupported(): boolean {
  return isTauri();
}

export async function saveLocalResource(
  documentId: string | number,
  file: File,
): Promise<LocalResource> {
  if (!isTauri()) throw new Error('LOCAL_RESOURCE_REQUIRES_DESKTOP');
  const id = resourceId();
  const relativePath = resourceRelativePath(documentId, id, file.name);
  const directory = relativePath.slice(0, relativePath.lastIndexOf('/'));
  await mkdir(directory, { baseDir: BaseDirectory.AppLocalData, recursive: true });
  await writeFile(relativePath, new Uint8Array(await file.arrayBuffer()), {
    baseDir: BaseDirectory.AppLocalData,
  });
  return {
    id,
    originalName: file.name,
    relativePath,
    mimeType: file.type || null,
    sizeBytes: file.size,
    createdAt: new Date().toISOString(),
  };
}

export async function removeLocalResource(relativePath: string): Promise<void> {
  if (!isTauri() || !relativePath) return;
  await remove(relativePath, { baseDir: BaseDirectory.AppLocalData });
}

export async function resourceUrl(relativePath: string): Promise<string> {
  if (!isTauri() || !relativePath) return relativePath;
  const root = await appDataDir();
  return convertFileSrc(await join(root, relativePath));
}

export async function resolveMarkdownResourceUrls(markdown: string): Promise<string> {
  if (!isTauri()) return markdown;
  const matches = [...markdown.matchAll(/(?:dt-resource:|resources\/)([^)\s]+)/g)];
  if (!matches.length) return markdown;
  let result = markdown;
  for (const match of matches) {
    const raw = match[0];
    const relativePath = raw.startsWith('dt-resource:') ? raw.slice('dt-resource:'.length) : raw;
    result = result.replace(raw, await resourceUrl(relativePath));
  }
  return result;
}
