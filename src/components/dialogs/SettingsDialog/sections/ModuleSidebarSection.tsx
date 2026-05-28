import { useEffect, useRef, useState } from 'react';
import type { ComponentType } from 'react';
import type { ModuleSidebarTab } from '@/lib/communityModules/types';

type ModuleSidebarComponent = ComponentType<{
  moduleId: string;
  moduleName: string;
  entryId: string;
}>;
type ModuleSidebarDomRenderer = ((props: {
  moduleId: string;
  moduleName: string;
  entryId: string;
}) => HTMLElement) & { __xdispatchDomRenderer?: boolean };

interface ModuleSidebarSectionProps {
  tab: ModuleSidebarTab;
}

export function ModuleSidebarSection({ tab }: ModuleSidebarSectionProps) {
  const [Component, setComponent] = useState<ModuleSidebarComponent | null>(null);
  const [domRenderer, setDomRenderer] = useState<ModuleSidebarDomRenderer | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      try {
        const mod = await import(/* @vite-ignore */ tab.rendererUrl);
        const Candidate = mod.default as
          | ModuleSidebarComponent
          | ModuleSidebarDomRenderer
          | undefined;
        if (!Candidate) {
          throw new Error(`Module ${tab.moduleId} does not export a default component`);
        }
        if (cancelled) return;

        if ((Candidate as ModuleSidebarDomRenderer).__xdispatchDomRenderer) {
          setDomRenderer(() => Candidate as ModuleSidebarDomRenderer);
          setComponent(null);
          return;
        }

        setComponent(() => Candidate as ModuleSidebarComponent);
        setDomRenderer(null);
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
    if (domRenderer) {
      return <ModuleSidebarDomHost renderer={domRenderer} tab={tab} />;
    }
    return (
      <div className="space-y-2">
        <h2 className="text-lg font-semibold">{tab.label}</h2>
        <p className="text-sm text-muted-foreground">Loading module...</p>
      </div>
    );
  }

  return <Component moduleId={tab.moduleId} moduleName={tab.moduleName} entryId={tab.entryId} />;
}

function ModuleSidebarDomHost({
  renderer,
  tab,
}: {
  renderer: ModuleSidebarDomRenderer;
  tab: ModuleSidebarTab;
}) {
  const hostRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;
    host.innerHTML = '';
    const mounted = renderer({
      moduleId: tab.moduleId,
      moduleName: tab.moduleName,
      entryId: tab.entryId,
    });
    host.appendChild(mounted);
    return () => {
      if (host.contains(mounted)) host.removeChild(mounted);
    };
  }, [renderer, tab.entryId, tab.moduleId, tab.moduleName]);

  return <div ref={hostRef} />;
}
