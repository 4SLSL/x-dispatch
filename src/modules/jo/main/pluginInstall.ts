import { net } from 'electron';
import * as fs from 'fs';
import * as fsp from 'fs/promises';
import path from 'path';
import { getActiveInstallation } from '@/lib/xplaneServices/dataService/config';
import { detectJoPlugin, expectedXplFileName, joInstallTargetDir } from '../lib/pluginPaths';
import type { JoDownloadInfo } from '../lib/types';

const JO_REPO = '4SLSL/JFS4XD';
const JOINFS_SOURCES_URL = 'https://github.com/omx5o/JoinFS';
const JOINFS_RELEASES_URL = 'https://github.com/tuduce/JoinFS/releases/latest';

interface GhReleaseAsset {
  name: string;
  browser_download_url: string;
}

interface GhRelease {
  tag_name: string;
  html_url: string;
  body?: string;
  assets?: GhReleaseAsset[];
}

async function fetchLatestRelease(repo: string): Promise<GhRelease | null> {
  return new Promise((resolve) => {
    const req = net.request({
      method: 'GET',
      url: `https://api.github.com/repos/${repo}/releases/latest`,
      headers: {
        Accept: 'application/vnd.github+json',
        'User-Agent': 'x-dispatch-jo-module',
      },
    });
    let body = '';
    req.on('response', (res) => {
      res.on('data', (chunk) => {
        body += chunk.toString();
      });
      res.on('end', () => {
        if (res.statusCode !== 200) {
          resolve(null);
          return;
        }
        try {
          resolve(JSON.parse(body) as GhRelease);
        } catch {
          resolve(null);
        }
      });
    });
    req.on('error', () => resolve(null));
    req.end();
  });
}

function pickXplAsset(assets: GhReleaseAsset[] | undefined): GhReleaseAsset | null {
  if (!assets?.length) return null;
  const expected = expectedXplFileName(process.platform);
  return (
    assets.find((a) => a.name === expected) ??
    assets.find((a) => a.name.toLowerCase().endsWith('.xpl')) ??
    assets.find((a) => a.name.toLowerCase().endsWith('.zip')) ??
    null
  );
}

export async function getJoDownloadInfo(): Promise<JoDownloadInfo> {
  const release = await fetchLatestRelease(JO_REPO);
  if (release) {
    const asset = pickXplAsset(release.assets);
    return {
      available: true,
      label: `JFS4XD ${release.tag_name}`,
      url: asset?.browser_download_url ?? release.html_url,
      version: release.tag_name,
      notes: release.body?.slice(0, 400),
    };
  }
  return {
    available: true,
    label: 'JFS4XD / JoinFS sources',
    url: JOINFS_SOURCES_URL,
    notes: `Compilez depuis vendor/JoinFS-XP (${JO_REPO}) ou installez via JoinFS : ${JOINFS_RELEASES_URL}`,
  };
}

export async function getJoPluginDetection() {
  const inst = getActiveInstallation();
  return detectJoPlugin(inst?.path ?? null);
}

export async function installJoPluginFromFile(sourcePath: string): Promise<{
  success: boolean;
  error?: string;
}> {
  const inst = getActiveInstallation();
  if (!inst?.path) {
    return { success: false, error: 'no_xplane_path' };
  }

  const targetDir = joInstallTargetDir(inst.path);
  await fsp.mkdir(targetDir, { recursive: true });
  const targetName = expectedXplFileName(process.platform);
  const targetPath = path.join(targetDir, targetName);

  try {
    const stat = await fsp.stat(sourcePath);
    if (stat.isDirectory()) {
      const inner = path.join(sourcePath, targetName);
      if (!fs.existsSync(inner)) {
        return { success: false, error: 'xpl_not_found_in_folder' };
      }
      await fsp.copyFile(inner, targetPath);
    } else if (sourcePath.toLowerCase().endsWith('.xpl')) {
      await fsp.copyFile(sourcePath, targetPath);
    } else {
      return { success: false, error: 'unsupported_file' };
    }
    return { success: true };
  } catch (err) {
    return { success: false, error: (err as Error).message };
  }
}
