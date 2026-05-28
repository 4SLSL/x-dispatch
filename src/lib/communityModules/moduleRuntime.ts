import * as fs from 'fs';
import * as path from 'path';
import { pathToFileURL } from 'url';
import logger from '@/lib/utils/logger';
import type { ModuleRecord, ModuleResult } from './types';

export interface ModuleCallContext {
  userDataPath: string;
  installPath: string;
  moduleId: string;
}

type ModuleHandler = (ctx: ModuleCallContext, ...args: unknown[]) => Promise<unknown> | unknown;

export class ModuleRuntime {
  private readonly userDataPath: string;
  private handlers = new Map<string, Record<string, ModuleHandler>>();

  constructor(userDataPath: string) {
    this.userDataPath = userDataPath;
  }

  async reload(modules: Record<string, ModuleRecord>): Promise<void> {
    this.handlers.clear();
    for (const record of Object.values(modules)) {
      if (!record.enabled) continue;
      const entry = record.manifest.main?.entry;
      if (!entry) continue;

      const mainPath = path.resolve(record.installPath, entry);
      if (!mainPath.startsWith(record.installPath) || !fs.existsSync(mainPath)) {
        logger.main.warn(`module runtime: main entry missing for ${record.id}`);
        continue;
      }

      try {
        const mod = (await import(pathToFileURL(mainPath).href)) as {
          handlers?: Record<string, ModuleHandler>;
        };
        if (!mod.handlers || typeof mod.handlers !== 'object') {
          logger.main.warn(`module runtime: no handlers export in ${record.id}`);
          continue;
        }
        this.handlers.set(record.id, mod.handlers);
      } catch (e) {
        logger.main.warn(`module runtime: failed to load ${record.id}: ${(e as Error).message}`);
      }
    }
  }

  async call(
    record: ModuleRecord,
    method: string,
    args: unknown[]
  ): Promise<ModuleResult<unknown>> {
    const modHandlers = this.handlers.get(record.id);
    if (!modHandlers) {
      return {
        ok: false,
        error: { code: 'NOT_FOUND', message: `Module runtime not loaded: ${record.id}` },
      };
    }
    const handler = modHandlers[method];
    if (!handler) {
      return {
        ok: false,
        error: { code: 'NOT_FOUND', message: `Unknown module method: ${method}` },
      };
    }

    try {
      const ctx: ModuleCallContext = {
        userDataPath: this.userDataPath,
        installPath: record.installPath,
        moduleId: record.id,
      };
      const value = await handler(ctx, ...args);
      return { ok: true, value };
    } catch (e) {
      return {
        ok: false,
        error: { code: 'INSTALL_FAILED', message: (e as Error).message },
      };
    }
  }
}
