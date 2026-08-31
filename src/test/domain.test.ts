import { describe, expect, it } from 'vitest';
import { createBackupZip, readBackupZip } from '../services/backup';
import { isSafeZipPath, safeStoredFileName, sortDocumentsByPlan, validateBackupManifest } from '../utils/domain';
import { seedDocuments, seedProjects } from '../data/seed';

describe('domain utilities', () => {
  it('sorts planned documents newest first', () => {
    const sorted = sortDocumentsByPlan(seedDocuments);
    expect(sorted[0].plannedDate).toBe('2026-08-28');
    expect(sorted[sorted.length - 1]?.plannedDate).toBe('2026-08-25');
  });
  it('sanitizes stored attachment names', () => {
    expect(safeStoredFileName('../report:final.pdf', 'id')).toBe('id-..-report-final.pdf');
  });
  it('validates safe backup paths', () => {
    expect(isSafeZipPath('attachments/image.png')).toBe(true);
    expect(isSafeZipPath('../outside.txt')).toBe(false);
    expect(isSafeZipPath('C:/outside.txt')).toBe(false);
  });
  it('validates manifest and round-trips a backup', () => {
    const bytes = createBackupZip({ projects: seedProjects, documents: seedDocuments });
    const restored = readBackupZip(bytes);
    expect(validateBackupManifest(restored.manifest)).toBe(true);
    expect(restored.snapshot.documents).toHaveLength(seedDocuments.length);
  });
});

