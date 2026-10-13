import { spawn, type ChildProcess } from 'node:child_process';
import { NODE_SERVICE_TYPE } from '@cuccut/protocol';
import type { NodeLogger } from './node-logger.ts';

/**
 * mDNS registration (node protocol spec §12): when the node service starts listening, it registers `_cuccut-node._tcp`, with the instance name set to the node's name,
 * and TXT records `id=<nodeId>` and `v=<nodeProtocolVersion>`. TXT is for display only and does not establish trust.
 *
 * On macOS, the system's `dns-sd -R` is used (the registration stays while the process is alive and ends when the process exits). Other platforms do not register in this version.
 * Tests always inject a fake `Advertiser` and never touch the real mDNS.
 */

export interface AdvertiseInfo {
  name: string;
  port: number;
  nodeId: string;
  version: number;
}

export interface Advertiser {
  start(info: AdvertiseInfo): void;
  stop(): Promise<void>;
}

export const noopAdvertiser: Advertiser = {
  start() {},
  async stop() {},
};

export class DnsSdAdvertiser implements Advertiser {
  readonly #log: NodeLogger | undefined;
  readonly #command: string;
  #child: ChildProcess | null = null;

  constructor(options: { log?: NodeLogger; command?: string } = {}) {
    this.#log = options.log;
    this.#command = options.command ?? 'dns-sd';
  }

  start(info: AdvertiseInfo): void {
    void this.stop();
    const args = ['-R', info.name, NODE_SERVICE_TYPE, 'local', String(info.port), `id=${info.nodeId}`, `v=${info.version}`];
    const child = spawn(this.#command, args, { stdio: 'ignore' });
    child.on('error', (error) => this.#log?.warn('mDNS registration failed', { error: String(error) }));
    child.on('exit', (code, signal) => {
      if (this.#child === child) {
        this.#child = null;
        if (signal !== 'SIGTERM') this.#log?.warn('mDNS registration process exited', { code, signal });
      }
    });
    this.#child = child;
    this.#log?.info('mDNS registered', { port: info.port });
  }

  async stop(): Promise<void> {
    const child = this.#child;
    this.#child = null;
    if (!child || child.exitCode !== null || child.signalCode !== null) return;
    await new Promise<void>((resolve) => {
      const timer = setTimeout(() => {
        child.kill('SIGKILL');
        resolve();
      }, 2_000);
      child.once('exit', () => {
        clearTimeout(timer);
        resolve();
      });
      child.kill('SIGTERM');
    });
  }
}

/** Default registration method for this platform: `dns-sd` on macOS; other platforms do not register. */
export function defaultAdvertiser(platform: NodeJS.Platform = process.platform, log?: NodeLogger): Advertiser {
  return platform === 'darwin' ? new DnsSdAdvertiser(log ? { log } : {}) : noopAdvertiser;
}
