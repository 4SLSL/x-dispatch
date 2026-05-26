/** Traffic aircraft from the Jo bridge (JoinFS session). */
export interface JoAircraft {
  id: string;
  callsign: string;
  latitude: number;
  longitude: number;
  altitude: number;
  heading: number;
  groundspeed: number;
  aircraftType?: string;
  owner?: string;
  isUser?: boolean;
}

export interface JoBridgeStatus {
  ok: boolean;
  pluginInstalled: boolean;
  pluginPath?: string;
  bridgeReachable: boolean;
  sessionConnected: boolean;
  sessionName?: string;
  hubName?: string;
  aircraftCount: number;
  bridgeUrl: string;
  error?: string;
}

export interface JoTrafficSnapshot {
  updatedAt: string;
  aircraft: JoAircraft[];
}

export interface JoPluginDetection {
  installed: boolean;
  pluginDir?: string;
  xplFile?: string;
  legacyJoinFs?: boolean;
}

export interface JoDownloadInfo {
  available: boolean;
  label: string;
  url: string;
  version?: string;
  notes?: string;
}

export interface JoSessionState {
  running: boolean;
  connected: boolean;
  clientAvailable: boolean;
  sessionName?: string;
  hubName?: string;
  lastError?: string;
}

export interface JoJoinSessionRequest {
  hubAddress?: string;
  sessionName?: string;
  password?: string;
}

export interface JoJoinSessionResult {
  success: boolean;
  error?: string;
  session?: JoSessionState;
}
