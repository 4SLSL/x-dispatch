import { type ChildProcess, spawn } from 'node:child_process';
import * as fs from 'node:fs';
import path from 'node:path';
import logger from '@/lib/utils/logger';
import { getActiveInstallation } from '@/lib/xplaneServices/dataService/config';
import type { JoJoinSessionRequest, JoJoinSessionResult, JoSessionState } from '../lib/types';
import { getBridgeBaseUrl, ingest } from './bridgeServer';

const CLIENT_BIN_NAMES = ['jfs4xd-client', 'JoinFS-CONSOLE', 'JoinFS-XPLANE'];

export class JoinFsNetworkClient {
  private child: ChildProcess | null = null;
  private moduleInstallPath: string | null = null;
  private session: JoSessionState = {
    running: false,
    connected: false,
    clientAvailable: false,
  };

  configure(moduleInstallPath: string | null): void {
    this.moduleInstallPath = moduleInstallPath;
    this.session.clientAvailable = this.resolveClientBinary() !== null;
  }

  getSessionState(): JoSessionState {
    return { ...this.session };
  }

  private resolveClientBinary(): string | null {
    const platform = process.platform;
    const ext = platform === 'win32' ? '.exe' : '';
    const candidates: string[] = [];

    if (this.moduleInstallPath) {
      for (const name of CLIENT_BIN_NAMES) {
        candidates.push(path.join(this.moduleInstallPath, 'bin', `${name}${ext}`));
        candidates.push(path.join(this.moduleInstallPath, 'bin', platform, `${name}${ext}`));
      }
    }

    return candidates.find((p) => fs.existsSync(p)) ?? null;
  }

  private buildSpawnArgs(request: JoJoinSessionRequest): string[] {
    const args = ['--nogui', '--background', '--xplane', '--bridge', getBridgeBaseUrl()];
    const inst = getActiveInstallation();
    if (inst?.path) args.push('--simfolder', inst.path);

    const hub = request.hubAddress?.trim();
    if (hub) args.push('--join', hub);
    else args.push('--global');

    const password = request.password?.trim();
    if (password) args.push('--password', password);

    return args;
  }

  async start(request: JoJoinSessionRequest = {}): Promise<{ success: boolean; error?: string }> {
    if (this.child) await this.stop();

    const binary = this.resolveClientBinary();
    if (!binary) {
      this.session.running = false;
      this.session.clientAvailable = false;
      this.session.lastError = 'client_binary_missing';
      return { success: false, error: 'client_binary_missing' };
    }

    this.session.clientAvailable = true;
    const args = this.buildSpawnArgs(request);

    try {
      this.child = spawn(binary, args, {
        env: {
          ...process.env,
          JO_BRIDGE_URL: getBridgeBaseUrl(),
          JFS4XD_BRIDGE_URL: getBridgeBaseUrl(),
        },
        stdio: ['ignore', 'pipe', 'pipe'],
      });

      this.child.stdout?.on('data', (chunk: Buffer) => {
        logger.main.debug(`JFS4XD client: ${chunk.toString().trim()}`);
      });
      this.child.stderr?.on('data', (chunk: Buffer) => {
        logger.main.warn(`JFS4XD client: ${chunk.toString().trim()}`);
      });
      this.child.on('exit', (code) => {
        logger.main.info(`JFS4XD client exited (${code ?? 'signal'})`);
        this.child = null;
        this.session.running = false;
        this.session.connected = false;
        ingest({ sessionConnected: false, aircraft: [] });
      });

      this.session.running = true;
      this.session.lastError = undefined;
      logger.main.info(`JFS4XD client started: ${binary} ${args.join(' ')}`);
      return { success: true };
    } catch (err) {
      this.session.lastError = (err as Error).message;
      return { success: false, error: (err as Error).message };
    }
  }

  async stop(): Promise<void> {
    if (!this.child) {
      this.session.running = false;
      this.session.connected = false;
      return;
    }

    const proc = this.child;
    this.child = null;
    proc.kill('SIGTERM');

    await new Promise<void>((resolve) => {
      const timer = setTimeout(() => {
        if (!proc.killed) proc.kill('SIGKILL');
        resolve();
      }, 3000);
      proc.once('exit', () => {
        clearTimeout(timer);
        resolve();
      });
    });

    this.session.running = false;
    this.session.connected = false;
    ingest({ sessionConnected: false, aircraft: [] });
  }

  async joinSession(request: JoJoinSessionRequest): Promise<JoJoinSessionResult> {
    const start = await this.start(request);
    if (!start.success) {
      return { success: false, error: start.error ?? 'client_start_failed' };
    }

    this.session.sessionName = request.sessionName ?? request.hubAddress ?? 'Session JFS4XD';
    this.session.hubName = request.hubAddress;

    return {
      success: true,
      session: this.getSessionState(),
    };
  }

  async leaveSession(): Promise<void> {
    this.session.sessionName = undefined;
    this.session.hubName = undefined;
    await this.stop();
  }
}

export const joinFsNetworkClient = new JoinFsNetworkClient();
