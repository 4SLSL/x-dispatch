import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { AlertTriangle, Download, Plug, Radio, Users } from 'lucide-react';
import {
  SettingsHeader,
  SettingsSectionBlock,
} from '@/components/dialogs/SettingsDialog/primitives';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { JO_BRIDGE_DEFAULT_URL } from '@/modules/jo/lib/bridgeClient';
import type { JoDownloadInfo, JoPluginDetection } from '@/modules/jo/lib/types';
import { useJoStatusQuery } from '@/queries/useJoQuery';
import { useMapStore } from '@/stores/mapStore';

export function JoSettingsSection() {
  const { t } = useTranslation();
  const joEnabled = useMapStore((s) => s.joEnabled);
  const setJoEnabled = useMapStore((s) => s.setJoEnabled);
  const { data: status, refetch } = useJoStatusQuery(true);
  const [plugin, setPlugin] = useState<JoPluginDetection | null>(null);
  const [download, setDownload] = useState<JoDownloadInfo | null>(null);
  const [bridgeUrl, setBridgeUrl] = useState(JO_BRIDGE_DEFAULT_URL);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    void (async () => {
      const [p, d, url] = await Promise.all([
        window.joAPI.detectPlugin(),
        window.joAPI.getDownloadInfo(),
        window.joAPI.getBridgeUrl(),
      ]);
      setPlugin(p);
      setDownload(d);
      setBridgeUrl(url);
    })();
  }, []);

  const refreshPlugin = async () => {
    setPlugin(await window.joAPI.detectPlugin());
    void refetch();
  };

  const handleDownload = async () => {
    setBusy(true);
    try {
      await window.joAPI.openDownloadPage();
    } finally {
      setBusy(false);
    }
  };

  const handleInstallFromFile = async () => {
    setMessage(null);
    const file = await window.joAPI.browseForPlugin();
    if (!file) return;
    setBusy(true);
    try {
      const result = await window.joAPI.installPluginFromPath(file);
      if (result.success) {
        setMessage(t('jo.settings.installOk'));
        await refreshPlugin();
      } else {
        setMessage(t('jo.settings.installFailed', { error: result.error ?? t('common.error') }));
      }
    } finally {
      setBusy(false);
    }
  };

  const handleSaveBridge = async () => {
    await window.joAPI.setBridgeUrl(bridgeUrl);
    void refetch();
  };

  return (
    <div className="space-y-6">
      <SettingsHeader
        icon={Users}
        title={t('jo.settings.title')}
        description={t('jo.settings.description')}
      />

      {!plugin?.installed && (
        <div className="flex items-start gap-2 rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-sm">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-500" />
          <p>{t('jo.settings.pluginMissing')}</p>
        </div>
      )}

      {plugin?.legacyJoinFs && (
        <p className="text-sm text-muted-foreground">{t('jo.settings.legacyJoinFs')}</p>
      )}

      <SettingsSectionBlock title={t('jo.settings.pluginTitle')}>
        <p className="mb-3 text-sm text-muted-foreground">
          {plugin?.installed
            ? t('jo.settings.pluginInstalled', { path: plugin.xplFile ?? plugin.pluginDir ?? '' })
            : t('jo.settings.pluginNotInstalled')}
        </p>
        {message && <p className="mb-3 text-sm text-muted-foreground">{message}</p>}
        <div className="flex flex-wrap gap-2">
          <Button
            variant="default"
            size="sm"
            className="gap-1.5"
            disabled={busy}
            onClick={() => void handleDownload()}
          >
            <Download className="h-3.5 w-3.5" />
            {download?.label ?? t('jo.settings.download')}
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="gap-1.5"
            disabled={busy}
            onClick={() => void handleInstallFromFile()}
          >
            <Plug className="h-3.5 w-3.5" />
            {t('jo.settings.installFromFile')}
          </Button>
        </div>
      </SettingsSectionBlock>

      <SettingsSectionBlock title={t('jo.settings.bridgeTitle')}>
        <p className="mb-3 text-sm text-muted-foreground">{t('jo.settings.bridgeDescription')}</p>
        <div className="mb-3 grid gap-2 sm:grid-cols-[1fr_auto]">
          <div>
            <Label htmlFor="jo-bridge-url">{t('jo.settings.bridgeUrl')}</Label>
            <Input
              id="jo-bridge-url"
              value={bridgeUrl}
              onChange={(e) => setBridgeUrl(e.target.value)}
              placeholder={JO_BRIDGE_DEFAULT_URL}
            />
          </div>
          <div className="flex items-end">
            <Button variant="outline" size="sm" onClick={() => void handleSaveBridge()}>
              {t('common.save')}
            </Button>
          </div>
        </div>
        <div className="space-y-1 text-sm text-muted-foreground">
          <p className="flex items-center gap-2">
            <Radio className="h-3.5 w-3.5" />
            {status?.bridgeReachable ? t('jo.settings.bridgeOk') : t('jo.settings.bridgeOffline')}
          </p>
          <p>
            {status?.sessionConnected
              ? t('jo.settings.sessionConnected', {
                  name: status.sessionName ?? status.hubName ?? '—',
                  count: status.aircraftCount,
                })
              : t('jo.settings.sessionDisconnected')}
          </p>
        </div>
      </SettingsSectionBlock>

      <SettingsSectionBlock title={t('jo.settings.mapTitle')}>
        <p className="mb-3 text-sm text-muted-foreground">{t('jo.settings.mapDescription')}</p>
        <Button
          variant={joEnabled ? 'secondary' : 'default'}
          size="sm"
          onClick={() => setJoEnabled(!joEnabled)}
        >
          {joEnabled ? t('jo.settings.hideOnMap') : t('jo.settings.showOnMap')}
        </Button>
      </SettingsSectionBlock>

      <p className="text-xs text-muted-foreground">{t('jo.attribution')}</p>
    </div>
  );
}
