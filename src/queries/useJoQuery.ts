import { useQuery } from '@tanstack/react-query';
import type { JoAircraft, JoBridgeStatus, JoTrafficSnapshot } from '@/modules/jo/lib/types';

const joKeys = {
  all: ['jo'] as const,
  status: ['jo', 'status'] as const,
  traffic: ['jo', 'traffic'] as const,
};

const REFRESH_MS = 2000;

export function useJoStatusQuery(enabled: boolean) {
  return useQuery({
    queryKey: joKeys.status,
    queryFn: () => window.joAPI.getStatus() as Promise<JoBridgeStatus>,
    enabled,
    refetchInterval: enabled ? REFRESH_MS : false,
    staleTime: REFRESH_MS - 200,
  });
}

export function useJoTrafficQuery(enabled: boolean, sessionConnected: boolean) {
  return useQuery({
    queryKey: joKeys.traffic,
    queryFn: () => window.joAPI.getTraffic() as Promise<JoTrafficSnapshot>,
    enabled: enabled && sessionConnected,
    refetchInterval: enabled && sessionConnected ? REFRESH_MS : false,
    staleTime: REFRESH_MS - 200,
  });
}

export function getJoAircraftInBounds(
  data: JoTrafficSnapshot | undefined,
  bounds: { north: number; south: number; east: number; west: number }
): JoAircraft[] {
  if (!data?.aircraft) return [];
  return data.aircraft.filter(
    (a) =>
      a.latitude >= bounds.south &&
      a.latitude <= bounds.north &&
      a.longitude >= bounds.west &&
      a.longitude <= bounds.east
  );
}
