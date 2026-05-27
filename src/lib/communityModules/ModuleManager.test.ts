import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ModuleManager, resetModuleManagerForTests } from './ModuleManager';
import { MANIFEST_FILENAME } from './types';

vi.mock('electron', () => ({
  app: {
    getVersion: () => '1.9.1',
    getPath: () => '/tmp/x-dispatch-test',
  },
}));
vi.mock('@/lib/utils/logger', () => ({
  default: { main: { info: vi.fn(), warn: vi.fn() } },
}));

describe('ModuleManager', () => {
  const tmpRoots: string[] = [];

  afterEach(() => {
    resetModuleManagerForTests();
    for (const root of tmpRoots) {
      fs.rmSync(root, { recursive: true, force: true });
    }
    tmpRoots.length = 0;
  });

  function tempUserData(): string {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'xd-modules-'));
    tmpRoots.push(dir);
    return dir;
  }

  function writeExternalModule(
    userData: string,
    id: string,
    manifest: Record<string, unknown>
  ): void {
    const dir = path.join(userData, 'community-modules', 'external', id);
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(path.join(dir, MANIFEST_FILENAME), JSON.stringify(manifest));
  }

  it('starts empty', () => {
    const mgr = new ModuleManager(tempUserData());
    mgr.init();
    expect(mgr.list()).toEqual([]);
  });

  it('reconciles external modules from disk', () => {
    const userData = tempUserData();
    writeExternalModule(userData, 'com.test.sample', {
      id: 'com.test.sample',
      name: 'Sample',
      version: '1.0.0',
    });

    const mgr = new ModuleManager(userData);
    mgr.init();
    const list = mgr.list();
    expect(list).toHaveLength(1);
    expect(list[0]?.id).toBe('com.test.sample');
    expect(list[0]?.enabled).toBe(true);
  });

  it('enable and disable update state', () => {
    const userData = tempUserData();
    writeExternalModule(userData, 'com.test.toggle', {
      id: 'com.test.toggle',
      name: 'Toggle',
      version: '1.0.0',
    });

    const mgr = new ModuleManager(userData);
    mgr.init();

    const disabled = mgr.disable('com.test.toggle');
    expect(disabled.ok).toBe(true);
    if (disabled.ok) expect(disabled.value.enabled).toBe(false);

    const enabled = mgr.enable('com.test.toggle');
    expect(enabled.ok).toBe(true);
    if (enabled.ok) expect(enabled.value.enabled).toBe(true);
  });

  it('uninstalls external modules', () => {
    const userData = tempUserData();
    writeExternalModule(userData, 'com.test.remove', {
      id: 'com.test.remove',
      name: 'Remove',
      version: '1.0.0',
    });

    const mgr = new ModuleManager(userData);
    mgr.init();
    const result = mgr.uninstall('com.test.remove');
    expect(result.ok).toBe(true);
    expect(mgr.list()).toEqual([]);
  });

  it('rejects uninstalling bundled modules', () => {
    const userData = tempUserData();
    const mgr = new ModuleManager(userData);
    mgr.init();
    const statePath = path.join(userData, 'community-modules', 'state.json');
    fs.mkdirSync(path.dirname(statePath), { recursive: true });
    fs.writeFileSync(
      statePath,
      JSON.stringify({
        version: 1,
        modules: {
          'com.bundled.demo': {
            id: 'com.bundled.demo',
            kind: 'bundled',
            enabled: true,
            installPath: path.join(userData, 'bundled', 'com.bundled.demo'),
            manifest: {
              id: 'com.bundled.demo',
              name: 'Demo',
              version: '1.0.0',
              kind: 'bundled',
            },
            installedAt: '2026-01-01T00:00:00.000Z',
            updatedAt: '2026-01-01T00:00:00.000Z',
          },
        },
      })
    );

    const mgr2 = new ModuleManager(userData);
    mgr2.init();
    const result = mgr2.uninstall('com.bundled.demo');
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe('BUNDLED_UNINSTALL');
  });
});
