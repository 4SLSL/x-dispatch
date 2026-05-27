import { z } from 'zod';

export const MANIFEST_FILENAME = 'x-dispatch-module.json';

export const moduleKindSchema = z.enum(['bundled', 'external']);

export const moduleManifestSchema = z.object({
  id: z
    .string()
    .min(3)
    .max(128)
    .regex(/^[a-z0-9][a-z0-9.-]*[a-z0-9]$/i, 'id must be a reverse-domain style slug'),
  name: z.string().min(1).max(120),
  version: z
    .string()
    .regex(/^\d+\.\d+\.\d+(-[a-zA-Z0-9.-]+)?$/, 'version must be semver (e.g. 1.0.0)'),
  description: z.string().max(500).optional(),
  author: z.string().max(120).optional(),
  minAppVersion: z
    .string()
    .regex(/^\d+\.\d+\.\d+$/)
    .optional(),
  kind: moduleKindSchema.optional(),
});

export type ModuleManifest = z.infer<typeof moduleManifestSchema>;
export type ModuleKind = z.infer<typeof moduleKindSchema>;

export interface ModuleRecord {
  id: string;
  kind: ModuleKind;
  enabled: boolean;
  installPath: string;
  manifest: ModuleManifest;
  installedAt: string;
  updatedAt: string;
}

export interface ModuleListItem {
  id: string;
  kind: ModuleKind;
  enabled: boolean;
  name: string;
  version: string;
  description?: string;
  author?: string;
  installPath: string;
  installedAt: string;
  updatedAt: string;
}

export interface ModuleCatalogEntry {
  id: string;
  name: string;
  version: string;
  description?: string;
  author?: string;
  downloadUrl?: string;
  repositoryUrl?: string;
}

export interface ModuleCatalog {
  version: number;
  modules: ModuleCatalogEntry[];
}

export type ModuleErrorCode =
  | 'INVALID_MANIFEST'
  | 'MANIFEST_NOT_FOUND'
  | 'UNSUPPORTED_FORMAT'
  | 'EXTRACTION_FAILED'
  | 'ALREADY_INSTALLED'
  | 'NOT_FOUND'
  | 'BUNDLED_UNINSTALL'
  | 'MIN_APP_VERSION'
  | 'INSTALL_FAILED'
  | 'BROWSE_FAILED'
  | 'INVALID_INPUT';

export interface ModuleError {
  code: ModuleErrorCode;
  message: string;
}

export type ModuleResult<T> = { ok: true; value: T } | { ok: false; error: ModuleError };

export interface PersistedModuleState {
  version: 1;
  modules: Record<string, ModuleRecord>;
}
