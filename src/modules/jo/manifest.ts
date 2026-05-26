import type { XDispatchModuleManifest } from '@/lib/modules/types';

export const joManifest: XDispatchModuleManifest = {
  id: 'jo',
  name: 'Jo multiplayer',
  version: '1.0.0',
  description:
    'JoinFS / Jo session traffic on the map — requires the Jo X-Plane plugin and local bridge',
  author: '4SLSL',
  minAppVersion: '1.9.1a',
  kind: 'bundled',
  defaultEnabled: false,
  contributions: {
    settingsTabs: [{ tabId: 'jo', labelKey: 'modules.jo.settingsTab' }],
    toolbarToggles: [{ toggleId: 'jo-traffic' }],
    mapHooks: [{ hookId: 'jo-traffic' }],
  },
};
