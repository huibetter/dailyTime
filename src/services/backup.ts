import { unzipSync, zipSync } from 'fflate';
import type { BackupManifest, WorkspaceSnapshot } from '../types/domain';
import { isSafeZipPath, validateBackupManifest } from '../utils/domain';

export const createManifest = (snapshot: WorkspaceSnapshot): BackupManifest => ({
  app: 'DailyTime', formatVersion: 1, databaseVersion: 1,
  exportedAt: new Date().toISOString(),
  attachmentCount: snapshot.documents.flatMap((doc) => doc.attachments).length,
  checksums: {},
});

export function createBackupZip(snapshot: WorkspaceSnapshot) {
  const manifest = createManifest(snapshot);
  return zipSync({
    'manifest.json': new TextEncoder().encode(JSON.stringify(manifest, null, 2)),
    'workspace.json': new TextEncoder().encode(JSON.stringify(snapshot, null, 2)),
  });
}

export function readBackupZip(bytes: Uint8Array): { manifest: BackupManifest; snapshot: WorkspaceSnapshot } {
  const files = unzipSync(bytes);
  for (const name of Object.keys(files)) if (!isSafeZipPath(name)) throw new Error('备份包含不安全的文件路径');
  const manifestRaw = files['manifest.json'];
  const workspaceRaw = files['workspace.json'];
  if (!manifestRaw || !workspaceRaw) throw new Error('备份缺少必要文件');
  const manifest = JSON.parse(new TextDecoder().decode(manifestRaw)) as unknown;
  if (!validateBackupManifest(manifest)) throw new Error('备份版本不受支持');
  return { manifest, snapshot: JSON.parse(new TextDecoder().decode(workspaceRaw)) as WorkspaceSnapshot };
}
