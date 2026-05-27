import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { ModuleListItem } from '@/lib/communityModules/types';

export const communityModulesQueryKey = ['community-modules'] as const;

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

export function useCommunityModulesMutations() {
  const queryClient = useQueryClient();

  const invalidate = () => queryClient.invalidateQueries({ queryKey: communityModulesQueryKey });

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

  return { installFromZip, setEnabled, uninstall };
}
