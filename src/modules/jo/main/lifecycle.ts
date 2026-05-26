import logger from '@/lib/utils/logger';
import { registerJoIPC, unregisterJoIPC } from './joIpc';

const JO_MODULE_ID = 'jfs4xd';

let joRuntimeEnabled = false;

export function isJoRuntimeEnabled(): boolean {
  return joRuntimeEnabled;
}

export async function enableJoModule(): Promise<void> {
  if (joRuntimeEnabled) return;
  registerJoIPC();
  joRuntimeEnabled = true;
  logger.main.info(`${JO_MODULE_ID} runtime enabled`);
}

export async function disableJoModule(): Promise<void> {
  if (!joRuntimeEnabled) return;
  unregisterJoIPC();
  joRuntimeEnabled = false;
  logger.main.info(`${JO_MODULE_ID} runtime disabled`);
}

export async function syncJoModule(enabled: boolean): Promise<void> {
  if (enabled) await enableJoModule();
  else await disableJoModule();
}
