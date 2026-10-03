import { describe, expect, it } from 'vitest';
import { persistWorkspaceChanges } from './repository';
import type { RuntimeDocument, RuntimeProject, RuntimeState } from './runtime-storage';

function project(id: string): RuntimeProject {
  return { id, name: id, color: '#8ca69b' };
}

function document(id: string, projectId: string): RuntimeDocument {
  return {
    id,
    project: projectId,
    title: id,
    content: `# ${id}`,
    updated: '刚刚',
    planned: null,
    plannedTime: null,
    status: '未开始',
    tags: [],
    attachments: [],
  };
}

describe('workspace persistence', () => {
  it('persists only created, updated, and deleted entities', async () => {
    const calls: string[] = [];
    const repository = {
      loadState: async () => ({ projects: [], docs: [] }),
      loadSettings: async () => null,
      upsertProject: async (value: RuntimeProject): Promise<void> => {
        calls.push(`project:${value.id}`);
      },
      deleteProject: async (id: string): Promise<void> => {
        calls.push(`delete-project:${id}`);
      },
      upsertDocument: async (value: RuntimeDocument): Promise<void> => {
        calls.push(`document:${value.id}`);
      },
      deleteDocument: async (id: string | number): Promise<void> => {
        calls.push(`delete-document:${id}`);
      },
      saveSettings: async (): Promise<void> => undefined,
    };
    const previous: RuntimeState = {
      projects: [project('p-old')],
      docs: [document('d-old', 'p-old')],
    };
    const next: RuntimeState = {
      projects: [project('p-new')],
      docs: [document('d-new', 'p-new')],
    };

    await persistWorkspaceChanges(repository, { previous, next });

    expect(calls).toEqual([
      'delete-project:p-old',
      'project:p-new',
      'delete-document:d-old',
      'document:d-new',
    ]);
  });
});
