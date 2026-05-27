import { app } from 'electron';
import * as fs from 'fs';
import * as fsp from 'fs/promises';
import path from 'path';
import { extractArchive } from '@/lib/addonManager/installer/extraction';
import logger from '@/lib/utils/logger';
import { compareSemverLike, isModuleManifest } from './manifest';
import type {
  InstalledModuleState,
  ModuleCatalogEntry,
  ModuleCatalogFile,
  ModuleRuntimeInfo,
  XDispatchModuleManifest,
} from './types';

interface ModulesStateFile {
  modules: InstalledModuleState[];
}

const MANIFEST_NAME = 'x-dispatch-module.json';
const STATE_FILE_NAME = 'modules-state.json';
const CATALOG_PATH = path.join(app.getAppPath(), 'registry', 'modules.json');
const APP_VERSION = app.getVersion();

export class ModuleManager {
  private readonly modulesRoot = path.join(app.getPath('userData'), 'community-modules');
  private readonly statePath = path.join(this.modulesRoot, STATE_FILE_NAME);
  private readonly bundledManifests = new Map<string, XDispatchModuleManifest>();
  private state: InstalledModuleState[] = [];

  async init(bundled: XDispatchModuleManifest[] = []): Promise<void> {
    await fsp.mkdir(this.modulesRoot, { recursive: true });
    this.bundledManifests.clear();
    for (const manifest of bundled) this.bundledManifests.set(manifest.id, manifest);
    await this.loadState();

    let changed = false;
    for (const manifest of bundled) {
      const existing = this.state.find((m) => m.id === manifest.id);
      if (existing) continue;
      this.state.push({
        id: manifest.id,
        enabled: true,
        source: 'bundled',
        installedAt: new Date().toISOString(),
      });
      changed = true;
    }
    if (changed) await this.saveState();
  }

  async getCatalog(): Promise<ModuleCatalogEntry[]> {
    try {
      const raw = await fsp.readFile(CATALOG_PATH, 'utf-8');
      const parsed = JSON.parse(raw) as ModuleCatalogFile;
      return Array.isArray(parsed.modules) ? parsed.modules : [];
    } catch {
      return [];
    }
  }

  async listModules(): Promise<ModuleRuntimeInfo[]> {
    const items: ModuleRuntimeInfo[] = [];
    for (const moduleState of this.state) {
      const manifest = await this.getManifestForState(moduleState);
      if (!manifest) continue;
      items.push({ manifest, state: moduleState });
    }
    return items.sort((a, b) => a.manifest.id.localeCompare(b.manifest.id));
  }

  async installFromZip(zipPath: string): Promise<{ success: boolean; error?: string }> {
    try {
      const tempDir = await fsp.mkdtemp(path.join(this.modulesRoot, '.tmp-module-'));
      const extractResult = await extractArchive({ archivePath: zipPath, targetDir: tempDir });
      if (!extractResult.ok) {
        return { success: false, error: `Extraction failed: ${extractResult.error.code}` };
      }

      const manifestPath = await this.findManifestPath(tempDir);
      if (!manifestPath) return { success: false, error: `Missing ${MANIFEST_NAME}` };

      const raw = await fsp.readFile(manifestPath, 'utf-8');
      const parsed: unknown = JSON.parse(raw);
      if (!isModuleManifest(parsed)) return { success: false, error: 'Invalid module manifest' };
      if (parsed.kind !== 'external') {
        return { success: false, error: 'Only external modules can be installed from ZIP' };
      }
      if (parsed.minAppVersion && !compareSemverLike(APP_VERSION, parsed.minAppVersion)) {
        return {
          success: false,
          error: `Module requires app >= ${parsed.minAppVersion}, current ${APP_VERSION}`,
        };
      }

      const finalDir = path.join(this.modulesRoot, parsed.id, parsed.version);
      await fsp.mkdir(path.dirname(finalDir), { recursive: true });
      if (fs.existsSync(finalDir)) await fsp.rm(finalDir, { recursive: true, force: true });
      await fsp.rename(path.dirname(manifestPath), finalDir);
      await fsp.rm(tempDir, { recursive: true, force: true });

      this.state = this.state.filter((m) => m.id !== parsed.id || m.source === 'bundled');
      this.state.push({
        id: parsed.id,
        enabled: true,
        source: 'zip',
        installPath: finalDir,
        installedAt: new Date().toISOString(),
      });
      await this.saveState();
      return { success: true };
    } catch (err) {
      logger.main.error('Module install failed', err);
      return { success: false, error: (err as Error).message };
    }
  }

  async setEnabled(
    moduleId: string,
    enabled: boolean
  ): Promise<{ success: boolean; error?: string }> {
    const target = this.state.find((m) => m.id === moduleId);
    if (!target) return { success: false, error: 'Unknown module' };
    target.enabled = enabled;
    await this.saveState();
    return { success: true };
  }

  async uninstall(moduleId: string): Promise<{ success: boolean; error?: string }> {
    const target = this.state.find((m) => m.id === moduleId && m.source !== 'bundled');
    if (!target) return { success: false, error: 'Only external modules can be removed' };
    if (target.installPath && fs.existsSync(target.installPath)) {
      await fsp.rm(target.installPath, { recursive: true, force: true });
    }
    this.state = this.state.filter((m) => !(m.id === moduleId && m.source !== 'bundled'));
    await this.saveState();
    return { success: true };
  }

  private async getManifestForState(
    state: InstalledModuleState
  ): Promise<XDispatchModuleManifest | null> {
    if (state.source === 'bundled') return this.bundledManifests.get(state.id) ?? null;
    if (!state.installPath) return null;
    try {
      const manifestPath = path.join(state.installPath, MANIFEST_NAME);
      const raw = await fsp.readFile(manifestPath, 'utf-8');
      const parsed: unknown = JSON.parse(raw);
      return isModuleManifest(parsed) ? parsed : null;
    } catch {
      return null;
    }
  }

  private async findManifestPath(rootDir: string): Promise<string | null> {
    const queue: string[] = [rootDir];
    while (queue.length > 0) {
      const current = queue.shift();
      if (!current) continue;
      let entries: fs.Dirent[];
      try {
        entries = await fsp.readdir(current, { withFileTypes: true });
      } catch {
        continue;
      }
      for (const entry of entries) {
        if (entry.isFile() && entry.name === MANIFEST_NAME) {
          return path.join(current, entry.name);
        }
      }
      for (const entry of entries) {
        if (entry.isDirectory()) queue.push(path.join(current, entry.name));
      }
    }
    return null;
  }

  private async loadState(): Promise<void> {
    try {
      const raw = await fsp.readFile(this.statePath, 'utf-8');
      const parsed = JSON.parse(raw) as ModulesStateFile;
      this.state = Array.isArray(parsed.modules) ? parsed.modules : [];
    } catch {
      this.state = [];
    }
  }

  private async saveState(): Promise<void> {
    await fsp.mkdir(path.dirname(this.statePath), { recursive: true });
    const payload: ModulesStateFile = { modules: this.state };
    await fsp.writeFile(this.statePath, JSON.stringify(payload, null, 2), 'utf-8');
  }
}
