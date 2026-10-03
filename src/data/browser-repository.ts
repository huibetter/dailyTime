import { normalizeDocument } from '../lib/document-utils';
import type { WorkspaceRepository } from './repository';
import type {
  RuntimeDocument,
  RuntimeProject,
  RuntimeSettings,
  RuntimeState,
} from './runtime-storage';

const PROJECTS_KEY = 'dt-projects';
const DOCUMENTS_KEY = 'dt-docs';
const PROFILE_KEY = 'dt-profile';

function readJson<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

function writeJson(key: string, value: unknown): void {
  localStorage.setItem(key, JSON.stringify(value));
}

export class BrowserWorkspaceRepository implements WorkspaceRepository {
  async loadState(): Promise<RuntimeState> {
    const projects = readJson<RuntimeProject[]>(PROJECTS_KEY, []);
    const docs = readJson<RuntimeDocument[]>(DOCUMENTS_KEY, []).map(normalizeDocument);
    return { projects, docs };
  }

  async loadSettings(): Promise<RuntimeSettings | null> {
    return readJson<RuntimeSettings | null>(PROFILE_KEY, null);
  }

  async upsertProject(project: RuntimeProject): Promise<void> {
    const projects = readJson<RuntimeProject[]>(PROJECTS_KEY, []);
    const next = projects.some((item) => item.id === project.id)
      ? projects.map((item) => (item.id === project.id ? project : item))
      : [...projects, project];
    writeJson(PROJECTS_KEY, next);
  }

  async deleteProject(id: string): Promise<void> {
    writeJson(
      PROJECTS_KEY,
      readJson<RuntimeProject[]>(PROJECTS_KEY, []).filter((project) => project.id !== id),
    );
    writeJson(
      DOCUMENTS_KEY,
      readJson<RuntimeDocument[]>(DOCUMENTS_KEY, []).filter((document) => document.project !== id),
    );
  }

  async upsertDocument(document: RuntimeDocument): Promise<void> {
    const documents = readJson<RuntimeDocument[]>(DOCUMENTS_KEY, []);
    const id = String(document.id);
    const next = documents.some((item) => String(item.id) === id)
      ? documents.map((item) => (String(item.id) === id ? document : item))
      : [document, ...documents];
    writeJson(DOCUMENTS_KEY, next);
  }

  async deleteDocument(id: string | number): Promise<void> {
    writeJson(
      DOCUMENTS_KEY,
      readJson<RuntimeDocument[]>(DOCUMENTS_KEY, []).filter(
        (document) => String(document.id) !== String(id),
      ),
    );
  }

  async saveSettings(settings: RuntimeSettings): Promise<void> {
    writeJson(PROFILE_KEY, settings);
  }
}
