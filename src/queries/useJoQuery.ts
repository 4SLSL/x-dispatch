import { useQuery } from '@tanstack/react-query';
import type { JoAircraft, JoBridgeStatus, JoTrafficSnapshot } from '@/modules/jo/lib/types';

const joKeys = {
  all: ['jfs4xd'] as const,
  status: ['jfs4xd', 'status'] as const,
  traffic: ['jfs4xd', 'traffic'] as const,
};

async function fetchJoStatus(): Promise<JoBridgeStatus> {
  return window.joAPI.getStatus();
}

async function fetchJoTraffic(): Promise<JoTrafficSnapshot> {
  return window.joAPI.getTraffic();
}

export function useJoStatusQuery(enabled: boolean) {
  return useQuery({
    queryKey: joKeys.status,
    queryFn: fetchJoStatus,
    enabled,
    staleTime: 1500,
    refetchInterval: enabled ? 2000 : false,
  });
}

export function useJoTrafficQuery(mapEnabled: boolean, sessionConnected: boolean) {
  const enabled = mapEnabled && sessionConnected;
  return useQuery({
    queryKey: joKeys.traffic,
    queryFn: fetchJoTraffic,
    enabled,
    staleTime: 1500,
    refetchInterval: enabled ? 2000 : false,
  });
}

export function getJoAircraftInBounds(
  traffic: JoTrafficSnapshot | undefined,
  bounds: { north: number; south: number; east: number; west: number }
): JoAircraft[] {
  if (!traffic?.aircraft) return [];
  return traffic.aircraft.filter(
    (a) =>
      a.latitude >= bounds.south &&
      a.latitude <= bounds.north &&
      a.longitude >= bounds.west &&
      a.longitude <= bounds.east
  );
}
