import { useTranslation } from 'react-i18next';
import { Package, Trash2, Upload } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import type { ModuleError } from '@/lib/communityModules/types';
import { cn } from '@/lib/utils/helpers';
import {
  useCommunityModulesContributionsQuery,
  useCommunityModulesMutations,
  useCommunityModulesQuery,
} from '@/queries/useCommunityModulesQuery';
import { SettingsEmptyState, SettingsHeader, SettingsToggleRow } from '../primitives';
import type { SettingsSectionProps } from '../types';
import { ModuleContributionsPanel } from './ModuleContributionsPanel';

function errorMessage(error: ModuleError, t: (key: string) => string): string {
  const key = `settings.modules.error.${error.code}`;
  const translated = t(key);
  return translated !== key ? translated : error.message;
}

export function ModulesSection({ className }: SettingsSectionProps = {}) {
  const { t } = useTranslation();
  const { data: modules = [], isLoading, refetch } = useCommunityModulesQuery();
  const { data: contributionGroups = [] } = useCommunityModulesContributionsQuery();
  const { installFromZip, setEnabled, uninstall } = useCommunityModulesMutations();

  const installZip = async () => {
    const browse = await window.modulesAPI.browseForZip();
    if (!browse.ok) {
      toast.error(errorMessage(browse.error, t));
      return;
    }
    if (!browse.value) return;

    try {
      await installFromZip.mutateAsync(browse.value);
      toast.success(t('settings.modules.installSuccess'));
    } catch (e) {
      toast.error(errorMessage(e as ModuleError, t));
    }
  };

  const toggleModule = async (id: string, enabled: boolean) => {
    try {
      await setEnabled.mutateAsync({ id, enabled });
    } catch (e) {
      toast.error(errorMessage(e as ModuleError, t));
    }
  };

  const removeModule = async (id: string) => {
    try {
      await uninstall.mutateAsync(id);
      toast.success(t('settings.modules.uninstallSuccess'));
    } catch (e) {
      toast.error(errorMessage(e as ModuleError, t));
    }
  };

  return (
    <div className={cn('space-y-6', className)}>
      <SettingsHeader
        icon={Package}
        title={t('settings.modules.title')}
        description={t('settings.modules.description')}
      />

      <p className="text-sm text-muted-foreground">{t('settings.modules.phase2Note')}</p>

      <div className="flex flex-wrap gap-2">
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => void installZip()}
          disabled={installFromZip.isPending}
        >
          <Upload className="mr-2 h-4 w-4" />
          {t('settings.modules.installZip')}
        </Button>
        <Button type="button" variant="ghost" size="sm" onClick={() => void refetch()}>
          {t('common.refresh')}
        </Button>
      </div>

      {isLoading ? (
        <p className="text-sm text-muted-foreground">{t('common.loading')}</p>
      ) : modules.length === 0 ? (
        <SettingsEmptyState message={t('settings.modules.empty')} />
      ) : (
        <div className="space-y-3">
          {modules.map((mod) => (
            <div key={mod.id} className="space-y-2">
              <SettingsToggleRow
                title={
                  <span>
                    {mod.name}{' '}
                    <span className="font-mono text-xs text-muted-foreground">
                      {t('settings.modules.versionLabel', { version: mod.version })}
                    </span>
                  </span>
                }
                description={
                  <span className="block space-y-1">
                    <span className="font-mono text-xs">{mod.id}</span>
                    {mod.description ? <span className="block">{mod.description}</span> : null}
                    {mod.kind === 'bundled' ? (
                      <span className="block text-xs">{t('settings.modules.bundledBadge')}</span>
                    ) : null}
                  </span>
                }
                checked={mod.enabled}
                onCheckedChange={(checked) => void toggleModule(mod.id, checked)}
                disabled={setEnabled.isPending}
              />
              {mod.kind === 'external' ? (
                <div className="flex justify-end pr-1">
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="text-destructive hover:text-destructive"
                    onClick={() => void removeModule(mod.id)}
                    disabled={uninstall.isPending}
                  >
                    <Trash2 className="mr-2 h-4 w-4" />
                    {t('settings.modules.uninstall')}
                  </Button>
                </div>
              ) : null}
            </div>
          ))}
        </div>
      )}

      <ModuleContributionsPanel groups={contributionGroups} />
    </div>
  );
}
