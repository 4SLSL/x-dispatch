import { ipcMain, shell } from 'electron';
import { JO_BRIDGE_DEFAULT_URL } from '../lib/bridgeClient';
import type { JoJoinSessionRequest } from '../lib/types';
import { getBridgeBaseUrl, getBridgeStatus, getTrafficSnapshot } from './bridgeServer';
import { joinFsNetworkClient } from './joinfsNetworkClient';
import { getJoDownloadInfo, getJoPluginDetection, installJoPluginFromFile } from './pluginInstall';

let useExternalBridge = false;
let externalBridgeUrl = JO_BRIDGE_DEFAULT_URL;

export function registerJoIPC(): void {
  ipcMain.handle('jo:getBridgeUrl', () =>
    useExternalBridge ? externalBridgeUrl : getBridgeBaseUrl()
  );

  ipcMain.handle('jo:setBridgeUrl', (_, url: string) => {
    const trimmed = (url || JO_BRIDGE_DEFAULT_URL).trim();
    const embedded = getBridgeBaseUrl();
    if (trimmed === embedded || trimmed === JO_BRIDGE_DEFAULT_URL) {
      useExternalBridge = false;
      externalBridgeUrl = JO_BRIDGE_DEFAULT_URL;
    } else {
      useExternalBridge = true;
      externalBridgeUrl = trimmed;
    }
    return { success: true, bridgeUrl: useExternalBridge ? externalBridgeUrl : embedded };
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
    if (useExternalBridge) {
      const { fetchJoBridgeStatus } = await import('../lib/bridgeClient');
      return fetchJoBridgeStatus(externalBridgeUrl, plugin.installed);
    }
    return getBridgeStatus(plugin.installed);
  });

  ipcMain.handle('jo:getTraffic', async () => {
    if (useExternalBridge) {
      const { fetchJoTraffic } = await import('../lib/bridgeClient');
      const snapshot = await fetchJoTraffic(externalBridgeUrl);
      return snapshot ?? { updatedAt: new Date().toISOString(), aircraft: [] };
    }
    return getTrafficSnapshot();
  });

  ipcMain.handle('jo:getSessionState', () => joinFsNetworkClient.getSessionState());

  ipcMain.handle('jo:joinSession', (_, request: JoJoinSessionRequest) =>
    joinFsNetworkClient.joinSession(request ?? {})
  );

  ipcMain.handle('jo:leaveSession', async () => {
    await joinFsNetworkClient.leaveSession();
    return { success: true };
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
    'jo:getSessionState',
    'jo:joinSession',
    'jo:leaveSession',
  ];
  for (const ch of channels) ipcMain.removeHandler(ch);
}
