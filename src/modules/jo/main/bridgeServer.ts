import http from 'node:http';
import logger from '@/lib/utils/logger';
import type { JoAircraft, JoBridgeStatus, JoTrafficSnapshot } from '../lib/types';

const DEFAULT_HOST = '127.0.0.1';
const DEFAULT_PORT = 9570;

interface BridgeState {
  sessionConnected: boolean;
  sessionName?: string;
  hubName?: string;
  aircraft: JoAircraft[];
}

let state: BridgeState = {
  sessionConnected: false,
  aircraft: [],
};

let server: http.Server | null = null;
let listenHost = DEFAULT_HOST;
let listenPort = DEFAULT_PORT;

function sendJson(res: http.ServerResponse, status: number, body: unknown): void {
  const payload = JSON.stringify(body);
  res.writeHead(status, {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
  });
  res.end(payload);
}

function readBody(req: http.IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    req.on('data', (chunk) => chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)));
    req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
    req.on('error', reject);
  });
}

function resetState(): void {
  state = {
    sessionConnected: false,
    aircraft: [],
  };
}

export function getBridgeBaseUrl(): string {
  return `http://${listenHost}:${listenPort}`;
}

export function isBridgeRunning(): boolean {
  return server?.listening === true;
}

export function ingest(payload: {
  sessionConnected?: boolean;
  sessionName?: string;
  hubName?: string;
  aircraft?: JoAircraft[];
}): void {
  if (typeof payload.sessionConnected === 'boolean') {
    state.sessionConnected = payload.sessionConnected;
  }
  if (payload.sessionName !== undefined) state.sessionName = payload.sessionName;
  if (payload.hubName !== undefined) state.hubName = payload.hubName;
  if (Array.isArray(payload.aircraft)) state.aircraft = payload.aircraft;
}

export function getBridgeStatus(pluginInstalled: boolean): JoBridgeStatus {
  return {
    ok: isBridgeRunning(),
    pluginInstalled,
    bridgeReachable: isBridgeRunning(),
    sessionConnected: state.sessionConnected,
    sessionName: state.sessionName,
    hubName: state.hubName,
    aircraftCount: state.aircraft.length,
    bridgeUrl: getBridgeBaseUrl(),
  };
}

export function getTrafficSnapshot(): JoTrafficSnapshot {
  return {
    updatedAt: new Date().toISOString(),
    aircraft: state.aircraft.filter(
      (a) => Number.isFinite(a.latitude) && Number.isFinite(a.longitude) && a.callsign && a.id
    ),
  };
}

export async function startBridgeServer(host = DEFAULT_HOST, port = DEFAULT_PORT): Promise<void> {
  if (server?.listening) return;

  listenHost = host;
  listenPort = port;

  server = http.createServer(async (req, res) => {
    const url = new URL(req.url ?? '/', `http://${req.headers.host}`);

    if (req.method === 'OPTIONS') {
      res.writeHead(204, {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type',
      });
      res.end();
      return;
    }

    if (req.method === 'GET' && url.pathname === '/v1/status') {
      sendJson(res, 200, {
        ok: true,
        sessionConnected: state.sessionConnected,
        sessionName: state.sessionName,
        hubName: state.hubName,
        aircraftCount: state.aircraft.length,
      });
      return;
    }

    if (req.method === 'GET' && url.pathname === '/v1/aircraft') {
      sendJson(res, 200, getTrafficSnapshot());
      return;
    }

    if (req.method === 'POST' && url.pathname === '/v1/ingest') {
      try {
        const raw = await readBody(req);
        const body = JSON.parse(raw || '{}') as {
          sessionConnected?: boolean;
          sessionName?: string;
          hubName?: string;
          aircraft?: JoAircraft[];
        };
        ingest(body);
        sendJson(res, 200, { ok: true, aircraftCount: state.aircraft.length });
      } catch (err) {
        sendJson(res, 400, { ok: false, error: String(err) });
      }
      return;
    }

    sendJson(res, 404, { ok: false, error: 'not_found' });
  });

  await new Promise<void>((resolve, reject) => {
    server!.once('error', reject);
    server!.listen(port, host, () => resolve());
  });

  logger.main.info(`JFS4XD bridge listening on ${getBridgeBaseUrl()}`);
}

export async function stopBridgeServer(): Promise<void> {
  if (!server) return;
  const current = server;
  server = null;
  resetState();
  await new Promise<void>((resolve, reject) => {
    current.close((err) => (err ? reject(err) : resolve()));
  });
  logger.main.info('JFS4XD bridge stopped');
}
