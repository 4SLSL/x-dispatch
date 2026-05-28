import { app } from 'electron';
import * as crypto from 'crypto';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { pathToFileURL } from 'url';
import { extractArchive } from '@/lib/addonManager/installer/extraction';
import logger from '@/lib/utils/logger';
import {
  type ModuleContributionGroup,
  collectContributions,
  pruneToggleStateForModule,
  setContributionToggle,
} from './contributions';
import { checkMinAppVersion, normalizeZipManifest, readAndValidateManifest } from './manifest';
import {
  MANIFEST_FILENAME,
  type ModuleCatalog,
  type ModuleListItem,
  type ModuleRecord,
  type ModuleResult,
  type ModuleSidebarTab,
  type PersistedModuleState,
} from './types';

const STATE_VERSION = 1 as const;

function moduleOk<T>(value: T): ModuleResult<T> {
  return { ok: true, value };
}

function moduleErr(code: import('./types').ModuleErrorCode, message: string): ModuleResult<never> {
  return { ok: false, error: { code, message } };
}

function toListItem(record: ModuleRecord): ModuleListItem {
  return {
    id: record.id,
    kind: record.kind,
    enabled: record.enabled,
    name: record.manifest.name,
    version: record.manifest.version,
    description: record.manifest.description,
    author: record.manifest.author,
    installPath: record.installPath,
    installedAt: record.installedAt,
    updatedAt: record.updatedAt,
  };
}

export class ModuleManager {
  private readonly baseDir: string;
  private readonly externalDir: string;
  private readonly statePath: string;
  private readonly toggleStatePath: string;
  private state: PersistedModuleState = { version: STATE_VERSION, modules: {} };
  private initialized = false;

  constructor(userDataPath: string) {
    this.baseDir = path.join(userDataPath, 'community-modules');
    this.externalDir = path.join(this.baseDir, 'external');
    this.statePath = path.join(this.baseDir, 'state.json');
    this.toggleStatePath = path.join(this.baseDir, 'contribution-toggles.json');
  }

  init(): void {
    if (this.initialized) return;
    fs.mkdirSync(this.externalDir, { recursive: true });
    this.loadState();
    this.reconcileExternal();
    this.initialized = true;
  }

  list(): ModuleListItem[] {
    this.init();
    return Object.values(this.state.modules)
      .map(toListItem)
      .sort((a, b) => a.name.localeCompare(b.name));
  }

  getContributions(): ModuleContributionGroup[] {
    this.init();
    return collectContributions(this.state.modules, this.toggleStatePath);
  }

  getSidebarTabs(): ModuleSidebarTab[] {
    this.init();
    const tabs: ModuleSidebarTab[] = [];

    for (const record of Object.values(this.state.modules)) {
      if (!record.enabled) continue;
      const contributions = record.manifest.contributions;
      const rendererEntry = record.manifest.renderer?.entry;
      if (!contributions?.sidebar?.length || !rendererEntry) continue;

      const absoluteRendererPath = path.resolve(record.installPath, rendererEntry);
      if (!absoluteRendererPath.startsWith(record.installPath)) continue;
      if (!fs.existsSync(absoluteRendererPath)) continue;
      const rendererUrl = pathToFileURL(absoluteRendererPath).toString();

      for (const entry of contributions.sidebar) {
        tabs.push({
          tabId: `module:${record.id}:${entry.id}`,
          moduleId: record.id,
          moduleName: record.manifest.name,
          entryId: entry.id,
          label: entry.label,
          description: entry.description,
          rendererUrl,
        });
      }
    }

    return tabs.sort((a, b) => a.label.localeCompare(b.label));
  }

  setContributionToggle(
    moduleId: string,
    contributionId: string,
    enabled: boolean
  ): ModuleResult<void> {
    this.init();
    const record = this.state.modules[moduleId];
    if (!record?.enabled) {
      return moduleErr('NOT_FOUND', `Enabled module not found: ${moduleId}`);
    }
    setContributionToggle(this.toggleStatePath, moduleId, contributionId, enabled);
    return moduleOk(undefined);
  }

  getCatalog(): ModuleCatalog {
    const catalogPath = resolveCatalogPath();
    if (!catalogPath) {
      return { version: 1, modules: [] };
    }
    try {
      const raw = JSON.parse(fs.readFileSync(catalogPath, 'utf-8')) as ModuleCatalog;
      if (typeof raw.version !== 'number' || !Array.isArray(raw.modules)) {
        return { version: 1, modules: [] };
      }
      return raw;
    } catch (e) {
      logger.main.warn(`community-modules: failed to read catalog: ${(e as Error).message}`);
      return { version: 1, modules: [] };
    }
  }

  async installFromZip(zipPath: string): Promise<ModuleResult<ModuleListItem>> {
    this.init();
    if (!zipPath || zipPath.includes('..')) {
      return moduleErr('INVALID_INPUT', 'Invalid archive path');
    }
    if (!fs.existsSync(zipPath)) {
      return moduleErr('INSTALL_FAILED', 'Archive file not found');
    }

    const tempDir = path.join(os.tmpdir(), `xdispatch_module_${crypto.randomUUID()}`);
    fs.mkdirSync(tempDir, { recursive: true });

    try {
      const extractResult = await extractArchive({ archivePath: zipPath, targetDir: tempDir });
      if (!extractResult.ok) {
        const code =
          extractResult.error.code === 'UNSUPPORTED_FORMAT'
            ? 'UNSUPPORTED_FORMAT'
            : 'EXTRACTION_FAILED';
        return moduleErr(code, extractResult.error.code);
      }

      const located = findModuleRoot(tempDir);
      if (!located) {
        return moduleErr('MANIFEST_NOT_FOUND', `${MANIFEST_FILENAME} not found in archive`);
      }

      const manifestResult = readAndValidateManifest(located.manifestPath);
      if (!manifestResult.ok) return manifestResult;

      const manifest = normalizeZipManifest(manifestResult.value);
      const versionCheck = checkMinAppVersion(manifest, app.getVersion());
      if (!versionCheck.ok) return versionCheck;

      const targetPath = path.join(this.externalDir, manifest.id);
      if (fs.existsSync(targetPath)) {
        fs.rmSync(targetPath, { recursive: true, force: true });
      }

      fs.cpSync(located.root, targetPath, { recursive: true });

      const now = new Date().toISOString();
      const existing = this.state.modules[manifest.id];
      const record: ModuleRecord = {
        id: manifest.id,
        kind: 'external',
        enabled: existing?.enabled ?? true,
        installPath: targetPath,
        manifest,
        installedAt: existing?.installedAt ?? now,
        updatedAt: now,
      };

      this.state.modules[manifest.id] = record;
      this.saveState();

      logger.main.info(`community-modules: installed ${manifest.id}@${manifest.version}`);
      return moduleOk(toListItem(record));
    } catch (e) {
      return moduleErr('INSTALL_FAILED', (e as Error).message);
    } finally {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  }

  enable(id: string): ModuleResult<ModuleListItem> {
    return this.setEnabled(id, true);
  }

  disable(id: string): ModuleResult<ModuleListItem> {
    return this.setEnabled(id, false);
  }

  uninstall(id: string): ModuleResult<void> {
    this.init();
    const record = this.state.modules[id];
    if (!record) return moduleErr('NOT_FOUND', `Module not found: ${id}`);
    if (record.kind === 'bundled') {
      return moduleErr('BUNDLED_UNINSTALL', 'Bundled modules cannot be uninstalled');
    }

    if (fs.existsSync(record.installPath)) {
      fs.rmSync(record.installPath, { recursive: true, force: true });
    }
    delete this.state.modules[id];
    pruneToggleStateForModule(this.toggleStatePath, id);
    this.saveState();
    logger.main.info(`community-modules: uninstalled ${id}`);
    return moduleOk(undefined);
  }

  private setEnabled(id: string, enabled: boolean): ModuleResult<ModuleListItem> {
    this.init();
    const record = this.state.modules[id];
    if (!record) return moduleErr('NOT_FOUND', `Module not found: ${id}`);

    record.enabled = enabled;
    record.updatedAt = new Date().toISOString();
    this.saveState();
    return moduleOk(toListItem(record));
  }

  private loadState(): void {
    if (!fs.existsSync(this.statePath)) return;
    try {
      const parsed = JSON.parse(fs.readFileSync(this.statePath, 'utf-8')) as PersistedModuleState;
      if (parsed.version === STATE_VERSION && parsed.modules) {
        this.state = parsed;
      }
    } catch (e) {
      logger.main.warn(`community-modules: corrupt state.json, resetting: ${(e as Error).message}`);
      this.state = { version: STATE_VERSION, modules: {} };
    }
  }

  private saveState(): void {
    fs.mkdirSync(this.baseDir, { recursive: true });
    fs.writeFileSync(this.statePath, JSON.stringify(this.state, null, 2), 'utf-8');
  }

  /** Drop state entries whose install dir disappeared; pick up valid dirs on disk. */
  private reconcileExternal(): void {
    if (!fs.existsSync(this.externalDir)) return;

    const onDisk = new Set<string>();
    for (const entry of fs.readdirSync(this.externalDir, { withFileTypes: true })) {
      if (!entry.isDirectory()) continue;
      const installPath = path.join(this.externalDir, entry.name);
      const manifestPath = path.join(installPath, MANIFEST_FILENAME);
      if (!fs.existsSync(manifestPath)) continue;

      const manifestResult = readAndValidateManifest(manifestPath);
      if (!manifestResult.ok) {
        logger.main.warn(`community-modules: skipping invalid module dir ${entry.name}`);
        continue;
      }

      const manifest = normalizeZipManifest(manifestResult.value);
      if (manifest.id !== entry.name) {
        logger.main.warn(
          `community-modules: folder ${entry.name} manifest id mismatch (${manifest.id})`
        );
        continue;
      }

      onDisk.add(manifest.id);
      const existing = this.state.modules[manifest.id];
      const now = new Date().toISOString();
      this.state.modules[manifest.id] = {
        id: manifest.id,
        kind: 'external',
        enabled: existing?.enabled ?? true,
        installPath,
        manifest,
        installedAt: existing?.installedAt ?? now,
        updatedAt: existing?.updatedAt ?? now,
      };
    }

    for (const id of Object.keys(this.state.modules)) {
      const record = this.state.modules[id];
      if (record?.kind === 'external' && !onDisk.has(id)) {
        delete this.state.modules[id];
      }
    }

    this.saveState();
  }
}

function findModuleRoot(extractedDir: string): { root: string; manifestPath: string } | null {
  const direct = path.join(extractedDir, MANIFEST_FILENAME);
  if (fs.existsSync(direct)) {
    return { root: extractedDir, manifestPath: direct };
  }

  for (const name of fs.readdirSync(extractedDir)) {
    const sub = path.join(extractedDir, name);
    if (!fs.statSync(sub).isDirectory()) continue;
    const manifestPath = path.join(sub, MANIFEST_FILENAME);
    if (fs.existsSync(manifestPath)) {
      return { root: sub, manifestPath };
    }
  }
  return null;
}

function resolveCatalogPath(): string | null {
  const candidates = [
    path.join(process.resourcesPath, 'registry', 'modules.json'),
    path.join(app.getAppPath(), '..', '..', 'registry', 'modules.json'),
    path.join(process.cwd(), 'registry', 'modules.json'),
  ];
  for (const candidate of candidates) {
    if (fs.existsSync(candidate)) return candidate;
  }
  return null;
}

let managerInstance: ModuleManager | null = null;

export function getModuleManager(): ModuleManager {
  if (!managerInstance) {
    managerInstance = new ModuleManager(app.getPath('userData'));
  }
  return managerInstance;
}

/** @internal test helper */
export function resetModuleManagerForTests(): void {
  managerInstance = null;
}
