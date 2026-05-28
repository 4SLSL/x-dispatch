import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { ModuleContributionGroup } from '@/lib/communityModules/contributions';
import type { ModuleListItem } from '@/lib/communityModules/types';

export const communityModulesQueryKey = ['community-modules'] as const;
export const communityModuleContributionsQueryKey = ['community-modules', 'contributions'] as const;
export const communityModuleSidebarTabsQueryKey = ['community-modules', 'sidebar-tabs'] as const;

export function useCommunityModulesQuery(enabled = true) {
  return useQuery({
    queryKey: communityModulesQueryKey,
    enabled,
    queryFn: async (): Promise<ModuleListItem[]> => {
      const result = await window.modulesAPI.list();
      if (!result.ok) throw new Error(result.error.message);
      return result.value;
    },
  });
}

export function useCommunityModulesContributionsQuery(enabled = true) {
  return useQuery({
    queryKey: communityModuleContributionsQueryKey,
    enabled,
    queryFn: async (): Promise<ModuleContributionGroup[]> => {
      const result = await window.modulesAPI.getContributions();
      if (!result.ok) throw new Error(result.error.message);
      return result.value;
    },
  });
}

export function useCommunityModuleSidebarTabsQuery(enabled = true) {
  return useQuery({
    queryKey: communityModuleSidebarTabsQueryKey,
    enabled,
    queryFn: async (): Promise<import('@/lib/communityModules/types').ModuleSidebarTab[]> => {
      const result = await window.modulesAPI.getSidebarTabs();
      if (!result.ok) throw new Error(result.error.message);
      return result.value;
    },
  });
}

export function useCommunityModulesMutations() {
  const queryClient = useQueryClient();

  const invalidate = () => {
    void queryClient.invalidateQueries({ queryKey: communityModulesQueryKey });
    void queryClient.invalidateQueries({ queryKey: communityModuleContributionsQueryKey });
    void queryClient.invalidateQueries({ queryKey: communityModuleSidebarTabsQueryKey });
  };

  const installFromZip = useMutation({
    mutationFn: async (zipPath: string) => {
      const result = await window.modulesAPI.installFromZip(zipPath);
      if (!result.ok) throw result.error;
      return result.value;
    },
    onSuccess: invalidate,
  });

  const setEnabled = useMutation({
    mutationFn: async ({ id, enabled }: { id: string; enabled: boolean }) => {
      const result = enabled
        ? await window.modulesAPI.enable(id)
        : await window.modulesAPI.disable(id);
      if (!result.ok) throw result.error;
      return result.value;
    },
    onSuccess: invalidate,
  });

  const uninstall = useMutation({
    mutationFn: async (id: string) => {
      const result = await window.modulesAPI.uninstall(id);
      if (!result.ok) throw result.error;
    },
    onSuccess: invalidate,
  });

  const setContributionToggle = useMutation({
    mutationFn: async (input: { moduleId: string; contributionId: string; enabled: boolean }) => {
      const result = await window.modulesAPI.setContributionToggle(input);
      if (!result.ok) throw result.error;
    },
    onSuccess: invalidate,
  });

  return { installFromZip, setEnabled, uninstall, setContributionToggle };
}
