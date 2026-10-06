import { describe, expect, it } from 'vitest';
import {
  EDITOR_FORMAT_DOCUMENT_ID,
  EDITOR_PERFORMANCE_DOCUMENT_ID,
  EDITOR_TEST_PROJECT_ID,
  createEditorTestWorkspace,
  removeEditorTestWorkspace,
} from './editor-test-fixtures';

describe('editor test fixtures', () => {
  it('creates two stable documents without changing unrelated data', () => {
    const existing = {
      projects: [{ id: 'other', name: '其他项目', color: '#999' }],
      docs: [
        {
          id: 'other-doc',
          project: 'other',
          title: '其他文档',
          content: 'keep',
          updated: '刚刚',
          planned: null,
          plannedTime: null,
          status: '未开始' as const,
          tags: [],
          attachments: [],
        },
      ],
    };
    const next = createEditorTestWorkspace(existing);
    expect(next.projects.find((item) => item.id === 'other')).toEqual(existing.projects[0]);
    expect(next.docs.find((item) => item.id === 'other-doc')).toEqual(existing.docs[0]);
    expect(next.projects.some((item) => item.id === EDITOR_TEST_PROJECT_ID)).toBe(true);
    expect(next.docs.map((item) => item.id)).toEqual([
      'other-doc',
      EDITOR_FORMAT_DOCUMENT_ID,
      EDITOR_PERFORMANCE_DOCUMENT_ID,
    ]);
    expect(
      next.docs.find((item) => item.id === EDITOR_PERFORMANCE_DOCUMENT_ID)?.content.length,
    ).toBeGreaterThan(10000);
    expect(
      next.docs
        .find((item) => item.id === EDITOR_PERFORMANCE_DOCUMENT_ID)
        ?.content.match(/- \[[ x]\]/g)?.length,
    ).toBeGreaterThanOrEqual(50);
  });

  it('removes only the dedicated test project', () => {
    const state = createEditorTestWorkspace({ projects: [], docs: [] });
    const next = removeEditorTestWorkspace(state);
    expect(next.projects).toEqual([]);
    expect(next.docs).toEqual([]);
  });
});
