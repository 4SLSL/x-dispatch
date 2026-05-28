import { type BrowserWindow, dialog, ipcMain } from 'electron';
import logger from '@/lib/utils/logger';
import { getModuleManager } from './ModuleManager';
import type { ModuleContributionGroup } from './contributions';
import type { ModuleListItem, ModuleResult } from './types';

export function registerCommunityModulesIPC(getMainWindow: () => BrowserWindow | null): void {
  const manager = () => getModuleManager();

  const notifyLifecycle = (moduleId: string, enabled: boolean) => {
    const win = getMainWindow();
    if (!win || win.isDestroyed()) return;
    win.webContents.send('modules:lifecycle', { moduleId, enabled });
  };

  ipcMain.handle('modules:list', (): ModuleResult<ModuleListItem[]> => {
    try {
      return { ok: true, value: manager().list() };
    } catch (e) {
      return {
        ok: false,
        error: { code: 'INSTALL_FAILED', message: (e as Error).message },
      };
    }
  });

  ipcMain.handle('modules:getContributions', (): ModuleResult<ModuleContributionGroup[]> => {
    try {
      return { ok: true, value: manager().getContributions() };
    } catch (e) {
      return {
        ok: false,
        error: { code: 'INSTALL_FAILED', message: (e as Error).message },
      };
    }
  });

  ipcMain.handle('modules:getCatalog', () => {
    try {
      return { ok: true, value: manager().getCatalog() };
    } catch (e) {
      return {
        ok: false,
        error: { code: 'INSTALL_FAILED', message: (e as Error).message },
      };
    }
  });

  ipcMain.handle('modules:browseForZip', async (): Promise<ModuleResult<string | null>> => {
    const win = getMainWindow();
    const opts: Electron.OpenDialogOptions = {
      title: 'Select community module archive',
      filters: [
        { name: 'ZIP archives', extensions: ['zip'] },
        { name: 'All Files', extensions: ['*'] },
      ],
      properties: ['openFile'],
    };
    try {
      let result: Electron.OpenDialogReturnValue;
      if (win && !win.isDestroyed()) {
        if (!win.isFocused()) win.focus();
        result = await dialog.showOpenDialog(win, opts);
      } else {
        result = await dialog.showOpenDialog(opts);
      }
      if (result.canceled || result.filePaths.length === 0) {
        return { ok: true, value: null };
      }
      return { ok: true, value: result.filePaths[0] ?? null };
    } catch (e) {
      logger.main.warn(`modules:browseForZip failed: ${(e as Error).message}`);
      return {
        ok: false,
        error: { code: 'BROWSE_FAILED', message: (e as Error).message },
      };
    }
  });

  ipcMain.handle('modules:installFromZip', async (_, zipPath: unknown) => {
    if (typeof zipPath !== 'string' || !zipPath) {
      return {
        ok: false,
        error: { code: 'INVALID_INPUT', message: 'zipPath must be a non-empty string' },
      };
    }
    if (zipPath.includes('..') || zipPath.length > 2000) {
      return { ok: false, error: { code: 'INVALID_INPUT', message: 'Invalid zipPath' } };
    }
    return manager().installFromZip(zipPath);
  });

  ipcMain.handle('modules:enable', async (_, id: unknown) => {
    if (typeof id !== 'string' || !id) {
      return { ok: false, error: { code: 'INVALID_INPUT', message: 'id required' } };
    }
    const result = manager().enable(id);
    if (result.ok) notifyLifecycle(id, true);
    return result;
  });

  ipcMain.handle('modules:disable', async (_, id: unknown) => {
    if (typeof id !== 'string' || !id) {
      return { ok: false, error: { code: 'INVALID_INPUT', message: 'id required' } };
    }
    const result = manager().disable(id);
    if (result.ok) notifyLifecycle(id, false);
    return result;
  });

  ipcMain.handle('modules:uninstall', async (_, id: unknown) => {
    if (typeof id !== 'string' || !id) {
      return { ok: false, error: { code: 'INVALID_INPUT', message: 'id required' } };
    }
    return manager().uninstall(id);
  });

  ipcMain.handle(
    'modules:setContributionToggle',
    async (_, payload: unknown): Promise<ModuleResult<void>> => {
      if (
        !payload ||
        typeof payload !== 'object' ||
        typeof (payload as { moduleId?: string }).moduleId !== 'string' ||
        typeof (payload as { contributionId?: string }).contributionId !== 'string' ||
        typeof (payload as { enabled?: boolean }).enabled !== 'boolean'
      ) {
        return { ok: false, error: { code: 'INVALID_INPUT', message: 'Invalid toggle payload' } };
      }
      const { moduleId, contributionId, enabled } = payload as {
        moduleId: string;
        contributionId: string;
        enabled: boolean;
      };
      return manager().setContributionToggle(moduleId, contributionId, enabled);
    }
  );
}
