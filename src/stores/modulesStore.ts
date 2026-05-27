import { create } from 'zustand';
import type { ModuleRuntimeInfo } from '@/lib/modules/types';

interface ModulesStoreState {
  modules: ModuleRuntimeInfo[];
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
}

export const useModulesStore = create<ModulesStoreState>((set) => ({
  modules: [],
  loading: false,
  error: null,
  refresh: async () => {
    set({ loading: true, error: null });
    try {
      const modules = await window.modulesAPI.list();
      set({ modules, loading: false });
    } catch (err) {
      set({ loading: false, error: (err as Error).message });
    }
  },
}));

if (typeof window !== 'undefined') {
  window.modulesAPI.onChanged(() => {
    void useModulesStore.getState().refresh();
  });
}
