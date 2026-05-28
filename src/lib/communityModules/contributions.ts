import * as fs from 'fs';
import * as path from 'path';
import type { ModuleRecord } from './types';
import { moduleManifestSchema } from './types';

const TOGGLE_STATE_VERSION = 1 as const;

export interface ModuleSettingsLink {
  id: string;
  type: 'link';
  label: string;
  description?: string;
  url: string;
}

export interface ModuleSettingsToggle {
  id: string;
  type: 'toggle';
  label: string;
  description?: string;
  checked: boolean;
}

export type ModuleSettingsContribution = ModuleSettingsLink | ModuleSettingsToggle;

export interface ModuleContributionGroup {
  moduleId: string;
  moduleName: string;
  settings: ModuleSettingsContribution[];
  renderer?: { entry: string; loadable: false };
}

interface ToggleStateFile {
  version: typeof TOGGLE_STATE_VERSION;
  toggles: Record<string, boolean>;
}

function toggleKey(moduleId: string, contributionId: string): string {
  return `${moduleId}:${contributionId}`;
}

export function loadToggleState(statePath: string): Record<string, boolean> {
  if (!fs.existsSync(statePath)) return {};
  try {
    const parsed = JSON.parse(fs.readFileSync(statePath, 'utf-8')) as ToggleStateFile;
    if (parsed.version === TOGGLE_STATE_VERSION && parsed.toggles) return parsed.toggles;
  } catch {
    /* reset on corrupt file */
  }
  return {};
}

export function saveToggleState(statePath: string, toggles: Record<string, boolean>): void {
  fs.mkdirSync(path.dirname(statePath), { recursive: true });
  const payload: ToggleStateFile = { version: TOGGLE_STATE_VERSION, toggles };
  fs.writeFileSync(statePath, JSON.stringify(payload, null, 2), 'utf-8');
}

export function collectContributions(
  modules: Record<string, ModuleRecord>,
  toggleStatePath: string
): ModuleContributionGroup[] {
  const toggles = loadToggleState(toggleStatePath);
  const groups: ModuleContributionGroup[] = [];

  for (const record of Object.values(modules)) {
    if (!record.enabled) continue;
    const parsed = moduleManifestSchema.safeParse(record.manifest);
    if (!parsed.success) continue;

    const { contributions, renderer } = parsed.data;
    const settings: ModuleSettingsContribution[] = [];

    for (const row of contributions?.settings ?? []) {
      if (row.type === 'link') {
        settings.push({
          id: row.id,
          type: 'link',
          label: row.label,
          description: row.description,
          url: row.url,
        });
      } else {
        const key = toggleKey(record.id, row.id);
        settings.push({
          id: row.id,
          type: 'toggle',
          label: row.label,
          description: row.description,
          checked: toggles[key] ?? row.default ?? false,
        });
      }
    }

    const group: ModuleContributionGroup = {
      moduleId: record.id,
      moduleName: record.manifest.name,
      settings,
    };
    if (renderer?.entry) {
      group.renderer = { entry: renderer.entry, loadable: false };
    }
    if (settings.length > 0 || group.renderer) {
      groups.push(group);
    }
  }

  return groups.sort((a, b) => a.moduleName.localeCompare(b.moduleName));
}

export function setContributionToggle(
  toggleStatePath: string,
  moduleId: string,
  contributionId: string,
  enabled: boolean
): void {
  const toggles = loadToggleState(toggleStatePath);
  toggles[toggleKey(moduleId, contributionId)] = enabled;
  saveToggleState(toggleStatePath, toggles);
}

/** Strip contribution keys when a module is removed. */
export function pruneToggleStateForModule(toggleStatePath: string, moduleId: string): void {
  const toggles = loadToggleState(toggleStatePath);
  const prefix = `${moduleId}:`;
  let changed = false;
  for (const key of Object.keys(toggles)) {
    if (key.startsWith(prefix)) {
      delete toggles[key];
      changed = true;
    }
  }
  if (changed) saveToggleState(toggleStatePath, toggles);
}
