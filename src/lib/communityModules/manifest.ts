import * as fs from 'fs';
import { isNewerVersion } from '@/lib/utils/versionCompare';
import {
  MANIFEST_FILENAME,
  type ModuleManifest,
  type ModuleResult,
  moduleManifestSchema,
} from './types';

export function readAndValidateManifest(manifestPath: string): ModuleResult<ModuleManifest> {
  let raw: unknown;
  try {
    raw = JSON.parse(fs.readFileSync(manifestPath, 'utf-8'));
  } catch (e) {
    return {
      ok: false,
      error: {
        code: 'INVALID_MANIFEST',
        message: `Failed to parse ${MANIFEST_FILENAME}: ${(e as Error).message}`,
      },
    };
  }

  const parsed = moduleManifestSchema.safeParse(raw);
  if (!parsed.success) {
    const detail = parsed.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('; ');
    return {
      ok: false,
      error: { code: 'INVALID_MANIFEST', message: detail || 'Invalid manifest' },
    };
  }

  return { ok: true, value: parsed.data };
}

/** ZIP installs are always external; bundled modules ship with the app. */
export function normalizeZipManifest(manifest: ModuleManifest): ModuleManifest {
  return { ...manifest, kind: 'external' };
}

export function checkMinAppVersion(
  manifest: ModuleManifest,
  appVersion: string
): ModuleResult<void> {
  if (!manifest.minAppVersion) return { ok: true, value: undefined };
  // isNewerVersion(current, latest) is true when latest > current.
  if (isNewerVersion(appVersion, manifest.minAppVersion)) {
    return {
      ok: false,
      error: {
        code: 'MIN_APP_VERSION',
        message: `Requires X-Dispatch ${manifest.minAppVersion} or newer (current: ${appVersion})`,
      },
    };
  }
  return { ok: true, value: undefined };
}
