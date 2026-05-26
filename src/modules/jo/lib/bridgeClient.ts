import type { JoBridgeStatus, JoTrafficSnapshot } from './types';

export const JO_BRIDGE_DEFAULT_URL = 'http://127.0.0.1:9570';

function normalizeBaseUrl(url: string): string {
  return url.replace(/\/$/, '');
}

async function fetchJson<T>(url: string, timeoutMs = 2500): Promise<T | null> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      signal: controller.signal,
      headers: { Accept: 'application/json' },
    });
    if (!res.ok) return null;
    return (await res.json()) as T;
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

export async function fetchJoBridgeStatus(
  bridgeUrl: string,
  pluginInstalled: boolean
): Promise<JoBridgeStatus> {
  const base = normalizeBaseUrl(bridgeUrl);
  const status = await fetchJson<{
    ok?: boolean;
    sessionConnected?: boolean;
    sessionName?: string;
    hubName?: string;
    aircraftCount?: number;
    error?: string;
  }>(`${base}/v1/status`);

  if (!status) {
    return {
      ok: false,
      pluginInstalled,
      bridgeReachable: false,
      sessionConnected: false,
      aircraftCount: 0,
      bridgeUrl: base,
      error: 'bridge_unreachable',
    };
  }

  return {
    ok: Boolean(status.ok),
    pluginInstalled,
    bridgeReachable: true,
    sessionConnected: Boolean(status.sessionConnected),
    sessionName: status.sessionName,
    hubName: status.hubName,
    aircraftCount: status.aircraftCount ?? 0,
    bridgeUrl: base,
    error: status.error,
  };
}

export async function fetchJoTraffic(bridgeUrl: string): Promise<JoTrafficSnapshot | null> {
  const base = normalizeBaseUrl(bridgeUrl);
  const data = await fetchJson<{ updatedAt?: string; aircraft?: JoTrafficSnapshot['aircraft'] }>(
    `${base}/v1/aircraft`
  );
  if (!data?.aircraft) return null;
  return {
    updatedAt: data.updatedAt ?? new Date().toISOString(),
    aircraft: data.aircraft.filter(
      (a) => Number.isFinite(a.latitude) && Number.isFinite(a.longitude) && a.callsign && a.id
    ),
  };
}
