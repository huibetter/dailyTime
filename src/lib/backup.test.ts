/* @vitest-environment node */
import { describe, expect, it } from 'vitest';
import { backupToState, parseBackup, serializeBackup } from './backup';

const snapshot = {
  projects: [{ id: 'p-1', name: '项目', color: '#8ca69b' }],
  docs: [
    {
      id: 'd-1',
      project: 'p-1',
      title: '记录',
      content: '# 记录',
      updated: '刚刚',
      planned: null,
      plannedTime: null,
      status: '未开始' as const,
      tags: [],
      attachments: [],
    },
  ],
  profile: { name: '本机用户', workspace: '工作空间', avatar: '本' },
  preferences: {
    theme: 'light' as const,
    compact: false,
    sidebarCollapsed: false,
    timelineWidth: 224,
  },
};

describe('backup format', () => {
  it('serializes and restores a workspace snapshot', () => {
    const restored = parseBackup(serializeBackup(snapshot, '0.1.4'));
    expect(restored.formatVersion).toBe(1);
    expect(backupToState(restored)).toEqual({ projects: snapshot.projects, docs: snapshot.docs });
  });

  it('rejects malformed or unsupported backups', () => {
    expect(() => parseBackup('not-json')).toThrow('不是有效的 JSON');
    expect(() => parseBackup(JSON.stringify({ format: 'other', formatVersion: 1 }))).toThrow(
      '格式无效',
    );
  });

  it('rejects documents without a valid project', () => {
    const invalid = serializeBackup(
      { ...snapshot, docs: [{ ...snapshot.docs[0], project: 'missing' }] },
      '0.1.4',
    );
    expect(() => parseBackup(invalid)).toThrow('找不到所属项目');
  });
});
