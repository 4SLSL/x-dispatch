import { useMemo } from 'react';
import maplibregl from 'maplibre-gl';
import type { MapRef } from '@/components/Map/hooks/useMapSetup';
import { useJoStatusQuery } from '@/queries/useJoQuery';
import { useJoTrafficSync } from './hooks/useJoTrafficSync';

/** Map hooks for Jo / JoinFS session traffic. */
export function JoMapHooks({ mapRef }: { mapRef: MapRef }) {
  const popup = useMemo(
    () =>
      new maplibregl.Popup({
        closeButton: true,
        closeOnClick: true,
        maxWidth: '280px',
        className: 'jfs4xd-traffic-popup',
      }),
    []
  );

  const { data: status } = useJoStatusQuery(true);
  useJoTrafficSync({
    mapRef,
    popup,
    sessionConnected: Boolean(status?.sessionConnected),
  });

  return null;
}
