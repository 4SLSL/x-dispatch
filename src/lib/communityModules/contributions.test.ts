import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { afterEach, describe, expect, it } from 'vitest';
import { collectContributions, loadToggleState, setContributionToggle } from './contributions';
import type { ModuleRecord } from './types';

describe('collectContributions', () => {
  const tmpDirs: string[] = [];

  afterEach(() => {
    for (const dir of tmpDirs) fs.rmSync(dir, { recursive: true, force: true });
    tmpDirs.length = 0;
  });

  it('returns settings rows for enabled modules only', () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'xd-contrib-'));
    tmpDirs.push(dir);
    const togglePath = path.join(dir, 'contribution-toggles.json');
    const modules: Record<string, ModuleRecord> = {
      'com.test.on': {
        id: 'com.test.on',
        kind: 'external',
        enabled: true,
        installPath: '/tmp/on',
        manifest: {
          id: 'com.test.on',
          name: 'On',
          version: '1.0.0',
          contributions: {
            settings: [
              { id: 'docs', type: 'link', label: 'Docs', url: 'https://example.com' },
              { id: 'flag', type: 'toggle', label: 'Flag', default: true },
            ],
          },
        },
        installedAt: '2026-01-01T00:00:00.000Z',
        updatedAt: '2026-01-01T00:00:00.000Z',
      },
      'com.test.off': {
        id: 'com.test.off',
        kind: 'external',
        enabled: false,
        installPath: '/tmp/off',
        manifest: { id: 'com.test.off', name: 'Off', version: '1.0.0' },
        installedAt: '2026-01-01T00:00:00.000Z',
        updatedAt: '2026-01-01T00:00:00.000Z',
      },
    };

    const groups = collectContributions(modules, togglePath);
    expect(groups).toHaveLength(1);
    expect(groups[0]?.settings).toHaveLength(2);
    const toggle = groups[0]?.settings.find((s) => s.type === 'toggle');
    expect(toggle && toggle.type === 'toggle' && toggle.checked).toBe(true);

    setContributionToggle(togglePath, 'com.test.on', 'flag', false);
    const toggles = loadToggleState(togglePath);
    expect(toggles['com.test.on:flag']).toBe(false);
  });
});
