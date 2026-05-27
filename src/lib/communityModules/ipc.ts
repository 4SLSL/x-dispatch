import { type BrowserWindow, dialog, ipcMain } from 'electron';
import logger from '@/lib/utils/logger';
import { getModuleManager } from './ModuleManager';
import type { ModuleListItem, ModuleResult } from './types';

export function registerCommunityModulesIPC(getMainWindow: () => BrowserWindow | null): void {
  const manager = () => getModuleManager();

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
    return manager().enable(id);
  });

  ipcMain.handle('modules:disable', async (_, id: unknown) => {
    if (typeof id !== 'string' || !id) {
      return { ok: false, error: { code: 'INVALID_INPUT', message: 'id required' } };
    }
    return manager().disable(id);
  });

  ipcMain.handle('modules:uninstall', async (_, id: unknown) => {
    if (typeof id !== 'string' || !id) {
      return { ok: false, error: { code: 'INVALID_INPUT', message: 'id required' } };
    }
    return manager().uninstall(id);
  });
}
