import { useEffect } from 'react';
import type maplibregl from 'maplibre-gl';
import type { MapRef } from '@/components/Map/hooks/useMapSetup';
import { getJoAircraftInBounds, useJoTrafficQuery } from '@/queries/useJoQuery';
import { useMapStore } from '@/stores/mapStore';
import {
  removeJoTrafficLayer,
  setupJoClickHandler,
  updateJoTrafficLayer,
} from '../layers/JoTrafficLayer';

interface UseJoTrafficSyncOptions {
  mapRef: MapRef;
  popup: maplibregl.Popup;
  sessionConnected: boolean;
}

export function useJoTrafficSync({
  mapRef,
  popup,
  sessionConnected,
}: UseJoTrafficSyncOptions): void {
  const joEnabled = useMapStore((s) => s.joEnabled);
  const { data: traffic } = useJoTrafficQuery(joEnabled, sessionConnected);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    if (!joEnabled) {
      removeJoTrafficLayer(map);
      return;
    }

    const updateJo = () => {
      if (!map.isStyleLoaded()) {
        map.once('styledata', updateJo);
        return;
      }

      const bounds = map.getBounds();
      const inView = getJoAircraftInBounds(traffic, {
        north: bounds.getNorthEast().lat,
        south: bounds.getSouthWest().lat,
        east: bounds.getNorthEast().lng,
        west: bounds.getSouthWest().lng,
      });

      void updateJoTrafficLayer(map, inView);
      setupJoClickHandler(map, popup);
    };

    const handleMoveEnd = () => {
      if (joEnabled && traffic) updateJo();
    };

    map.on('moveend', handleMoveEnd);
    updateJo();

    return () => {
      map.off('moveend', handleMoveEnd);
      map.off('styledata', updateJo);
    };
  }, [mapRef, popup, traffic, joEnabled]);
}
