import type { WorkspaceRepository } from './repository';
import {
  loadDesktopSettings,
  loadDesktopState,
  saveDesktopDocument,
  saveDesktopProject,
  saveDesktopSettings,
  deleteDesktopDocument,
  deleteDesktopProject,
} from './runtime-storage';
import type {
  RuntimeDocument,
  RuntimeProject,
  RuntimeSettings,
  RuntimeState,
} from './runtime-storage';

export class DesktopWorkspaceRepository implements WorkspaceRepository {
  loadState(): Promise<RuntimeState> {
    return loadDesktopState();
  }

  loadSettings(): Promise<RuntimeSettings | null> {
    return loadDesktopSettings();
  }

  saveSettings(settings: RuntimeSettings): Promise<void> {
    return saveDesktopSettings(settings);
  }

  upsertProject(project: RuntimeProject): Promise<void> {
    return saveDesktopProject(project);
  }

  deleteProject(id: string): Promise<void> {
    return deleteDesktopProject(id);
  }

  upsertDocument(document: RuntimeDocument): Promise<void> {
    return saveDesktopDocument(document);
  }

  deleteDocument(id: string | number): Promise<void> {
    return deleteDesktopDocument(id);
  }
}
