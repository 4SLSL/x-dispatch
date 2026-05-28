import { useTranslation } from 'react-i18next';
import type { ModuleContributionGroup } from '@/lib/communityModules/contributions';
import { cn } from '@/lib/utils/helpers';
import { useCommunityModulesMutations } from '@/queries/useCommunityModulesQuery';
import { SettingsLinkRow, SettingsSectionBlock, SettingsToggleRow } from '../primitives';

interface ModuleContributionsPanelProps {
  groups: ModuleContributionGroup[];
  className?: string;
}

export function ModuleContributionsPanel({ groups, className }: ModuleContributionsPanelProps) {
  const { t } = useTranslation();
  const { setContributionToggle } = useCommunityModulesMutations();

  if (groups.length === 0) return null;

  return (
    <div className={cn('space-y-4', className)}>
      <h3 className="text-sm font-medium">{t('settings.modules.contributionsTitle')}</h3>
      {groups.map((group) => (
        <SettingsSectionBlock key={group.moduleId} title={group.moduleName}>
          <div className="space-y-2">
            {group.settings.map((row) =>
              row.type === 'link' ? (
                <SettingsLinkRow
                  key={`${group.moduleId}:${row.id}`}
                  label={row.label}
                  href={row.url}
                />
              ) : (
                <SettingsToggleRow
                  key={`${group.moduleId}:${row.id}`}
                  title={row.label}
                  description={row.description}
                  checked={row.checked}
                  onCheckedChange={(checked) =>
                    void setContributionToggle.mutateAsync({
                      moduleId: group.moduleId,
                      contributionId: row.id,
                      enabled: checked,
                    })
                  }
                  disabled={setContributionToggle.isPending}
                />
              )
            )}
            {group.renderer ? (
              <p className="text-xs text-muted-foreground">
                {t('settings.modules.rendererStub', { entry: group.renderer.entry })}
              </p>
            ) : null}
          </div>
        </SettingsSectionBlock>
      ))}
    </div>
  );
}
