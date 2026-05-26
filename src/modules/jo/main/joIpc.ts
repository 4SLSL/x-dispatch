import { ipcMain, shell } from 'electron';
import { JO_BRIDGE_DEFAULT_URL, fetchJoBridgeStatus, fetchJoTraffic } from '../lib/bridgeClient';
import { getJoDownloadInfo, getJoPluginDetection, installJoPluginFromFile } from './pluginInstall';

let bridgeUrl = JO_BRIDGE_DEFAULT_URL;

export function registerJoIPC(): void {
  ipcMain.handle('jo:getBridgeUrl', () => bridgeUrl);

  ipcMain.handle('jo:setBridgeUrl', (_, url: string) => {
    bridgeUrl = (url || JO_BRIDGE_DEFAULT_URL).trim();
    return { success: true, bridgeUrl };
  });

  ipcMain.handle('jo:detectPlugin', () => getJoPluginDetection());

  ipcMain.handle('jo:getDownloadInfo', () => getJoDownloadInfo());

  ipcMain.handle('jo:openDownloadPage', async () => {
    const info = await getJoDownloadInfo();
    await shell.openExternal(info.url);
    return { success: true };
  });

  ipcMain.handle('jo:installPluginFromPath', (_, sourcePath: string) =>
    installJoPluginFromFile(sourcePath)
  );

  ipcMain.handle('jo:browseForPlugin', async () => {
    const { dialog, BrowserWindow } = await import('electron');
    const win = BrowserWindow.getFocusedWindow();
    const result = win
      ? await dialog.showOpenDialog(win, {
          title: 'Select Jo X-Plane plugin (.xpl)',
          properties: ['openFile'],
          filters: [{ name: 'X-Plane plugin', extensions: ['xpl'] }],
        })
      : await dialog.showOpenDialog({
          title: 'Select Jo X-Plane plugin (.xpl)',
          properties: ['openFile'],
          filters: [{ name: 'X-Plane plugin', extensions: ['xpl'] }],
        });
    if (result.canceled || !result.filePaths[0]) return null;
    return result.filePaths[0];
  });

  ipcMain.handle('jo:getStatus', async () => {
    const plugin = await getJoPluginDetection();
    return fetchJoBridgeStatus(bridgeUrl, plugin.installed);
  });

  ipcMain.handle('jo:getTraffic', async () => {
    const snapshot = await fetchJoTraffic(bridgeUrl);
    return snapshot ?? { updatedAt: new Date().toISOString(), aircraft: [] };
  });
}

export function unregisterJoIPC(): void {
  const channels = [
    'jo:getBridgeUrl',
    'jo:setBridgeUrl',
    'jo:detectPlugin',
    'jo:getDownloadInfo',
    'jo:openDownloadPage',
    'jo:installPluginFromPath',
    'jo:browseForPlugin',
    'jo:getStatus',
    'jo:getTraffic',
  ];
  for (const ch of channels) ipcMain.removeHandler(ch);
}
