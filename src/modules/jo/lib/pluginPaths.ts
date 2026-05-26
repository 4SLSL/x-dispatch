import * as fs from 'fs';
import path from 'path';
import type { JoPluginDetection } from './types';

export const JO_PLUGIN_DIR_NAMES = ['Jo', 'JoinFS'] as const;

const XPL_NAMES = ['mac.xpl', 'lin.xpl', 'win.xpl'] as const;

export function joPluginFolderName(platform: NodeJS.Platform): string {
  return 'Jo';
}

export function expectedXplFileName(platform: NodeJS.Platform): string {
  if (platform === 'darwin') return 'mac.xpl';
  if (platform === 'win32') return 'win.xpl';
  return 'lin.xpl';
}

export function detectJoPlugin(xplanePath: string | null): JoPluginDetection {
  if (!xplanePath) return { installed: false };

  const pluginsRoot = path.join(xplanePath, 'Resources', 'plugins');
  const expected = expectedXplFileName(process.platform);

  for (const dirName of JO_PLUGIN_DIR_NAMES) {
    const pluginDir = path.join(pluginsRoot, dirName);
    const direct = path.join(pluginDir, expected);
    if (fs.existsSync(direct)) {
      return {
        installed: true,
        pluginDir,
        xplFile: direct,
        legacyJoinFs: dirName === 'JoinFS',
      };
    }
    if (fs.existsSync(pluginDir)) {
      for (const name of XPL_NAMES) {
        const candidate = path.join(pluginDir, name);
        if (fs.existsSync(candidate)) {
          return {
            installed: true,
            pluginDir,
            xplFile: candidate,
            legacyJoinFs: dirName === 'JoinFS',
          };
        }
      }
    }
  }

  return { installed: false };
}

export function joInstallTargetDir(xplanePath: string): string {
  return path.join(xplanePath, 'Resources', 'plugins', joPluginFolderName(process.platform));
}
