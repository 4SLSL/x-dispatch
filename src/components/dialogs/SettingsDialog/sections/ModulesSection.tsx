import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Package } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { useModulesStore } from '@/stores/modulesStore';
import { SettingsEmptyState, SettingsHeader } from '../primitives';
import type { SettingsSectionProps } from '../types';

export function ModulesSection({ className }: SettingsSectionProps = {}) {
  const { t } = useTranslation();
  const { modules, loading, error, refresh } = useModulesStore();
  const [installing, setInstalling] = useState(false);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const installFromZip = async () => {
    const zipPath = await window.modulesAPI.browseForZip();
    if (!zipPath) return;
    setInstalling(true);
    const result = await window.modulesAPI.installFromZip(zipPath);
    setInstalling(false);
    if (!result.success) {
      toast.error(result.error ?? t('settings.modules.installError'));
      return;
    }
    await refresh();
    toast.success(t('settings.modules.installSuccess'));
  };

  return (
    <section className={className}>
      <SettingsHeader
        icon={Package}
        title={t('settings.modules.title')}
        description={t('settings.modules.description')}
      />

      <div className="mb-4">
        <Button onClick={installFromZip} disabled={installing}>
          {installing ? t('settings.modules.installing') : t('settings.modules.installZip')}
        </Button>
      </div>

      {loading ? (
        <p className="text-sm text-muted-foreground">{t('settings.modules.loading')}</p>
      ) : null}
      {error ? <p className="text-sm text-destructive">{error}</p> : null}

      {modules.length === 0 && !loading ? (
        <SettingsEmptyState message={t('settings.modules.empty')} />
      ) : null}

      <div className="space-y-2">
        {modules.map((item) => (
          <div
            key={item.manifest.id}
            className="flex items-center justify-between rounded-md border bg-card p-3"
          >
            <div>
              <p className="font-medium">{item.manifest.name}</p>
              <p className="text-xs text-muted-foreground">
                {t('settings.modules.meta', {
                  id: item.manifest.id,
                  version: item.manifest.version,
                })}
              </p>
            </div>
            <Switch
              checked={item.state.enabled}
              onCheckedChange={async (enabled) => {
                const result = await window.modulesAPI.setEnabled(item.manifest.id, enabled);
                if (!result.success) {
                  toast.error(result.error ?? t('settings.modules.updateError'));
                  return;
                }
                await refresh();
              }}
              aria-label={t('settings.modules.toggleAria', { name: item.manifest.name })}
            />
          </div>
        ))}
      </div>
    </section>
  );
}
