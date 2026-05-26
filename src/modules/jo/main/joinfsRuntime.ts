import logger from '@/lib/utils/logger';
import { startBridgeServer, stopBridgeServer } from './bridgeServer';
import { joinFsNetworkClient } from './joinfsNetworkClient';

let runtimeActive = false;

export function isJoinFsRuntimeActive(): boolean {
  return runtimeActive;
}

export async function startJoinFsRuntime(moduleInstallPath?: string | null): Promise<void> {
  if (runtimeActive) return;

  await startBridgeServer();
  joinFsNetworkClient.configure(moduleInstallPath ?? null);
  runtimeActive = true;
  logger.main.info('JFS4XD runtime started (embedded bridge + network client)');
}

export async function stopJoinFsRuntime(): Promise<void> {
  if (!runtimeActive) return;

  await joinFsNetworkClient.stop();
  await stopBridgeServer();
  runtimeActive = false;
  logger.main.info('JFS4XD runtime stopped');
}
