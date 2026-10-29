import { isDesktopStorage } from './runtime-storage';
import { BrowserWorkspaceRepository } from './browser-repository';
import { DesktopWorkspaceRepository } from './desktop-repository';
import type { WorkspaceRepository } from './repository';

export const workspaceRepository: WorkspaceRepository = isDesktopStorage()
  ? new DesktopWorkspaceRepository()
  : new BrowserWorkspaceRepository();
