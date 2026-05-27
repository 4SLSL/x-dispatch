export type ModuleKind = 'bundled' | 'external';

export interface XDispatchModuleManifest {
  id: string;
  name: string;
  version: string;
  kind: ModuleKind;
  minAppVersion?: string;
  description?: string;
}

export interface InstalledModuleState {
  id: string;
  enabled: boolean;
  source: 'bundled' | 'zip';
  installPath?: string;
  installedAt: string;
}

export interface ModuleRuntimeInfo {
  manifest: XDispatchModuleManifest;
  state: InstalledModuleState;
}

export interface ModuleCatalogEntry {
  id: string;
  name?: string;
  description?: string;
  repository?: string;
}

export interface ModuleCatalogFile {
  modules: ModuleCatalogEntry[];
}
