import { useEffect, useState } from 'react';
import type { ComponentType } from 'react';
import type { ModuleSidebarTab } from '@/lib/communityModules/types';

type ModuleSidebarComponent = ComponentType<{
  moduleId: string;
  moduleName: string;
  entryId: string;
}>;

interface ModuleSidebarSectionProps {
  tab: ModuleSidebarTab;
}

export function ModuleSidebarSection({ tab }: ModuleSidebarSectionProps) {
  const [Component, setComponent] = useState<ModuleSidebarComponent | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      try {
        const mod = await import(/* @vite-ignore */ tab.rendererUrl);
        const Candidate = mod.default as ModuleSidebarComponent | undefined;
        if (!Candidate) {
          throw new Error(`Module ${tab.moduleId} does not export a default component`);
        }
        if (!cancelled) setComponent(() => Candidate);
      } catch (e) {
        if (!cancelled) setError((e as Error).message);
      }
    };

    void load();
    return () => {
      cancelled = true;
    };
  }, [tab.entryId, tab.moduleId, tab.rendererUrl]);

  if (error) {
    return (
      <div className="space-y-2">
        <h2 className="text-lg font-semibold">{tab.label}</h2>
        <p className="text-sm text-destructive">{error}</p>
      </div>
    );
  }

  if (!Component) {
    return (
      <div className="space-y-2">
        <h2 className="text-lg font-semibold">{tab.label}</h2>
        <p className="text-sm text-muted-foreground">Loading module...</p>
      </div>
    );
  }

  return <Component moduleId={tab.moduleId} moduleName={tab.moduleName} entryId={tab.entryId} />;
}
