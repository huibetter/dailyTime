import type {
  RuntimeDocument,
  RuntimeProject,
  RuntimeSettings,
  RuntimeState,
} from './runtime-storage';

export interface WorkspaceRepository {
  loadState(): Promise<RuntimeState>;
  loadSettings(): Promise<RuntimeSettings | null>;
  upsertProject(project: RuntimeProject): Promise<void>;
  deleteProject(id: string): Promise<void>;
  upsertDocument(document: RuntimeDocument): Promise<void>;
  deleteDocument(id: string | number): Promise<void>;
  saveSettings(settings: RuntimeSettings): Promise<void>;
}

export interface WorkspaceChanges {
  previous: RuntimeState;
  next: RuntimeState;
}

function sameValue(left: unknown, right: unknown): boolean {
  return JSON.stringify(left) === JSON.stringify(right);
}

export async function persistWorkspaceChanges(
  repository: WorkspaceRepository,
  changes: WorkspaceChanges,
): Promise<void> {
  const previousProjects = new Map(
    changes.previous.projects.map((project) => [project.id, project]),
  );
  const nextProjects = new Map(changes.next.projects.map((project) => [project.id, project]));
  const previousDocuments = new Map(
    changes.previous.docs.map((document) => [String(document.id), document]),
  );
  const nextDocuments = new Map(
    changes.next.docs.map((document) => [String(document.id), document]),
  );

  for (const project of changes.previous.projects) {
    if (!nextProjects.has(project.id)) await repository.deleteProject(project.id);
  }
  for (const project of changes.next.projects) {
    if (!sameValue(previousProjects.get(project.id), project))
      await repository.upsertProject(project);
  }
  for (const document of changes.previous.docs) {
    if (!nextDocuments.has(String(document.id))) await repository.deleteDocument(document.id);
  }
  for (const document of changes.next.docs) {
    if (!sameValue(previousDocuments.get(String(document.id)), document))
      await repository.upsertDocument(document);
  }
}
