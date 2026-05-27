import { BrowserWindow, type OpenDialogOptions, dialog, ipcMain } from 'electron';
import { ModuleManager } from '@/lib/modules/ModuleManager';
import type { XDispatchModuleManifest } from '@/lib/modules/types';

let manager: ModuleManager | null = null;

function getManager(): ModuleManager {
  if (!manager) manager = new ModuleManager();
  return manager;
}

export async function initModuleManager(bundled: XDispatchModuleManifest[] = []): Promise<void> {
  await getManager().init(bundled);
}

export async function registerModulesIPC(getMainWindow: () => BrowserWindow | null): Promise<void> {
  ipcMain.handle('modules:list', () => getManager().listModules());
  ipcMain.handle('modules:catalog', () => getManager().getCatalog());
  ipcMain.handle('modules:setEnabled', async (_, moduleId: string, enabled: boolean) => {
    const result = await getManager().setEnabled(moduleId, enabled);
    if (result.success) getMainWindow()?.webContents.send('modules:changed');
    return result;
  });
  ipcMain.handle('modules:uninstall', async (_, moduleId: string) => {
    const result = await getManager().uninstall(moduleId);
    if (result.success) getMainWindow()?.webContents.send('modules:changed');
    return result;
  });
  ipcMain.handle('modules:installFromZip', async (_, zipPath: string) => {
    const result = await getManager().installFromZip(zipPath);
    if (result.success) getMainWindow()?.webContents.send('modules:changed');
    return result;
  });
  ipcMain.handle('modules:browseForZip', async () => {
    const win = getMainWindow();
    const opts: OpenDialogOptions = {
      title: 'Install X-Dispatch module from ZIP',
      properties: ['openFile'],
      filters: [{ name: 'ZIP archives', extensions: ['zip'] }],
    };
    const result = win ? await dialog.showOpenDialog(win, opts) : await dialog.showOpenDialog(opts);
    if (result.canceled || !result.filePaths[0]) return null;
    return result.filePaths[0];
  });
}
