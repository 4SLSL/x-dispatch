import type { XDispatchModuleManifest } from '@/lib/modules/types';

export const joManifest: XDispatchModuleManifest = {
  id: 'jfs4xd',
  name: 'JFS4XD multiplayer',
  version: '1.0.0',
  description:
    'JoinFS session traffic on the map — requires the JFS4XD X-Plane plugin and local bridge',
  author: '4SLSL',
  minAppVersion: '1.9.1a',
  kind: 'bundled',
  defaultEnabled: false,
  contributions: {
    settingsTabs: [{ tabId: 'jfs4xd', labelKey: 'modules.jfs4xd.settingsTab' }],
    toolbarToggles: [{ toggleId: 'jfs4xd-traffic' }],
    mapHooks: [{ hookId: 'jfs4xd-traffic' }],
  },
};
