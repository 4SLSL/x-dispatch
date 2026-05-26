import logger from '@/lib/utils/logger';
import { registerJoIPC, unregisterJoIPC } from './joIpc';
import { startJoinFsRuntime, stopJoinFsRuntime } from './joinfsRuntime';

const JO_MODULE_ID = 'jfs4xd';

let joRuntimeEnabled = false;

export function isJoRuntimeEnabled(): boolean {
  return joRuntimeEnabled;
}

export async function enableJoModule(moduleInstallPath?: string | null): Promise<void> {
  if (joRuntimeEnabled) return;
  await startJoinFsRuntime(moduleInstallPath);
  registerJoIPC();
  joRuntimeEnabled = true;
  logger.main.info(`${JO_MODULE_ID} runtime enabled`);
}

export async function disableJoModule(): Promise<void> {
  if (!joRuntimeEnabled) return;
  unregisterJoIPC();
  await stopJoinFsRuntime();
  joRuntimeEnabled = false;
  logger.main.info(`${JO_MODULE_ID} runtime disabled`);
}

export async function syncJoModule(
  enabled: boolean,
  moduleInstallPath?: string | null
): Promise<void> {
  if (enabled) await enableJoModule(moduleInstallPath);
  else await disableJoModule();
}
