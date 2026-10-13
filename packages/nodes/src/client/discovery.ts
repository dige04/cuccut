import { spawn, type ChildProcess } from 'node:child_process';
import { NODE_SERVICE_TYPE, type DiscoveredNode } from '@cuccut/protocol';
import type { NodeLogger } from '../node-logger.ts';

/**
 * Discovery (node protocol spec §12): browse the LAN for nodes that register `_cuccut-node._tcp`. The results are only for display and pre-filling addresses; they do not establish trust:
 * at pairing time, `/v1/health` and the `nodeId` in the pairing result are authoritative.
 *
 * macOS uses the system `dns-sd`: `-B` browses instances → for each instance, `-L` resolves the host, port and TXT (`id=<nodeId>`) → `-G v4` gets the host's
 * IPv4 addresses. `dns-sd` never ends on its own; all child processes are killed when the deadline arrives. Output is parsed line by line, and unrecognized lines are skipped. Other platforms return an empty list.
 * Tests inject a fake `Discoverer` and never touch the real mDNS.
 */

export interface Discoverer {
  /** Nodes discovered within `timeoutMs` (returns when the deadline arrives). */
  discover(timeoutMs: number): Promise<DiscoveredNode[]>;
}

export const noDiscoverer: Discoverer = {
  async discover() {
    return [];
  },
};

// ---- Parsing (output formats; samples captured in the tests) ----

const TIMESTAMP = String.raw`^\s*\d{1,2}:\d{2}:\d{2}\.\d{3}\s+`;
const TIMESTAMP_LINE = new RegExp(TIMESTAMP);
const BROWSE_LINE = new RegExp(String.raw`${TIMESTAMP}(Add|Rmv)\s+\d+\s+\d+\s+(\S+)\s+(\S+)\s+(.+?)\s*$`);
const LOOKUP_LINE = new RegExp(String.raw`${TIMESTAMP}(.+?) can be reached at (.+?):(\d+)(?:\s|$)`);
const ADDRESS_LINE = new RegExp(String.raw`${TIMESTAMP}(Add|Rmv)\s+[0-9a-fA-F]+\s+\d+\s+(\S+)\s+(\S+)(.*)$`);

export interface BrowseEvent {
  action: 'add' | 'remove';
  /** Instance name (the node's name), as is. */
  name: string;
}

/** One line of `dns-sd -B` → an instance appearing or disappearing; lines that are not for this service type, and header lines, return null. */
export function parseBrowseLine(line: string): BrowseEvent | null {
  const match = BROWSE_LINE.exec(line);
  if (!match) return null;
  const [, action, , serviceType, name] = match;
  if (serviceType!.replace(/\.$/, '') !== NODE_SERVICE_TYPE) return null;
  return { action: action === 'Add' ? 'add' : 'remove', name: name! };
}

export interface LookupResult {
  host: string;
  port: number;
  txt: Record<string, string>;
}

/**
 * `dns-sd -L` output → host, port and TXT. The trailing dot is removed from the host. TXT is on the line after "can be reached at",
 * as space-separated `key=value` (`\ ` is a space within a value). Returns null when not yet parsed.
 */
export function parseLookupOutput(output: string): LookupResult | null {
  const lines = output.split(/\r?\n/);
  for (let i = 0; i < lines.length; i++) {
    const match = LOOKUP_LINE.exec(lines[i]!);
    if (!match) continue;
    const host = match[2]!.trim().replace(/\.$/, '');
    const port = Number(match[3]);
    if (!host || !Number.isInteger(port) || port < 1 || port > 65_535) continue;
    const txtLine = lines[i + 1];
    const txt: Record<string, string> = {};
    if (txtLine !== undefined && !TIMESTAMP_LINE.test(txtLine)) {
      for (const entry of txtLine.trim().split(/(?<!\\) +/)) {
        const eq = entry.indexOf('=');
        if (eq <= 0) continue;
        txt[entry.slice(0, eq)] = unescapeDnsSd(entry.slice(eq + 1));
      }
    }
    return { host, port, txt };
  }
  return null;
}

/** `dns-sd -G v4` output → IPv4 addresses seen (deduplicated, in order of appearance; `No Such Record` and 0.0.0.0 are excluded). */
export function parseAddressOutput(output: string): string[] {
  const addresses: string[] = [];
  for (const line of output.split(/\r?\n/)) {
    const match = ADDRESS_LINE.exec(line);
    if (!match || match[1] !== 'Add') continue;
    const address = match[3]!;
    if (/No Such Record/i.test(match[4] ?? '')) continue;
    if (!isIPv4(address) || address === '0.0.0.0') continue;
    if (!addresses.includes(address)) addresses.push(address);
  }
  return addresses;
}

/** Pick an address for other machines to connect to: private-network addresses first, then other addresses; link-local and loopback last (a node on the same machine only has loopback). */
export function pickAddress(addresses: string[]): string | null {
  const rank = (address: string) => {
    if (address.startsWith('127.')) return 3;
    if (address.startsWith('169.254.')) return 2;
    return isPrivateIPv4(address) ? 0 : 1;
  };
  const sorted = addresses.filter((a) => isIPv4(a) && a !== '0.0.0.0').sort((a, b) => rank(a) - rank(b));
  return sorted[0] ?? null;
}

/** `dns-sd` escaping: `\DDD` is a decimal byte, `\x` is the character itself. */
export function unescapeDnsSd(text: string): string {
  const bytes: number[] = [];
  for (let i = 0; i < text.length; i++) {
    if (text[i] === '\\' && i + 1 < text.length) {
      const digits = /^\d{3}/.exec(text.slice(i + 1));
      if (digits) {
        bytes.push(Number(digits[0]) & 0xff);
        i += 3;
        continue;
      }
      i += 1;
    }
    const code = text.codePointAt(i)!;
    const ch = String.fromCodePoint(code);
    bytes.push(...Buffer.from(ch, 'utf8'));
    i += ch.length - 1;
  }
  return Buffer.from(bytes).toString('utf8');
}

function isIPv4(text: string): boolean {
  const parts = text.split('.');
  return parts.length === 4 && parts.every((p) => /^\d{1,3}$/.test(p) && Number(p) <= 255);
}

function isPrivateIPv4(address: string): boolean {
  const [a, b] = address.split('.').map(Number) as [number, number];
  return a === 10 || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168);
}

// ---- macOS dns-sd ----

/** When resolving an instance's addresses, how long to keep collecting addresses on other interfaces after the first address appears. */
const ADDRESS_SETTLE_MS = 200;
const OUTPUT_LIMIT = 1024 * 1024;

interface RunControl {
  stop(): void;
  /** Keep collecting output for another `ms`, then stop. */
  stopAfter(ms: number): void;
}

export class DnsSdDiscoverer implements Discoverer {
  readonly #command: string;
  readonly #log: NodeLogger | undefined;

  constructor(options: { command?: string; log?: NodeLogger } = {}) {
    this.#command = options.command ?? 'dns-sd';
    this.#log = options.log;
  }

  async discover(timeoutMs: number): Promise<DiscoveredNode[]> {
    const deadline = Date.now() + timeoutMs;
    const children = new Set<ChildProcess>();
    const found = new Map<string, DiscoveredNode>();
    const resolving = new Map<string, Promise<void>>();

    /** Run one `dns-sd` until `onOutput` stops it, the process exits, or the deadline arrives; then always kill it. */
    const run = (args: string[], onOutput: (all: string, control: RunControl) => void): Promise<void> =>
      new Promise((resolve) => {
        const remaining = deadline - Date.now();
        if (remaining <= 0) {
          resolve();
          return;
        }
        let child: ChildProcess;
        try {
          child = spawn(this.#command, args, { stdio: ['ignore', 'pipe', 'ignore'] });
        } catch {
          resolve();
          return;
        }
        children.add(child);
        let output = '';
        let done = false;
        const timers: Array<ReturnType<typeof setTimeout>> = [];
        const stop = () => {
          if (done) return;
          done = true;
          for (const timer of timers) clearTimeout(timer);
          children.delete(child);
          if (child.exitCode === null && child.signalCode === null) child.kill('SIGKILL');
          resolve();
        };
        timers.push(setTimeout(stop, remaining));
        const control: RunControl = { stop, stopAfter: (ms) => timers.push(setTimeout(stop, ms)) };
        child.on('error', (error) => {
          this.#log?.warn('mDNS browse failed', { error: String(error) });
          stop();
        });
        child.on('exit', stop);
        child.stdout!.setEncoding('utf8');
        child.stdout!.on('data', (chunk: string) => {
          if (done) return;
          // Defense: abnormally large output is no longer accumulated.
          if (output.length < OUTPUT_LIMIT) output += chunk;
          onOutput(output, control);
        });
      });

    const resolveInstance = async (name: string) => {
      let lookup: LookupResult | null = null;
      await run(['-L', name, NODE_SERVICE_TYPE, 'local'], (all, control) => {
        lookup = parseLookupOutput(all);
        if (lookup) control.stop();
      });
      const result = lookup as LookupResult | null;
      if (!result) return;
      let addresses: string[] = [];
      let settling = false;
      await run(['-G', 'v4', result.host], (all, control) => {
        addresses = parseAddressOutput(all);
        if (addresses.length > 0 && !settling) {
          settling = true;
          control.stopAfter(ADDRESS_SETTLE_MS);
        }
      });
      const host = pickAddress(addresses) ?? result.host;
      const id = result.txt.id;
      const nodeId = id && /^[A-Za-z0-9_-]{1,200}$/.test(id) ? id : null;
      found.set(name, { name, host, port: result.port, nodeId });
    };

    try {
      await run(['-B', NODE_SERVICE_TYPE, 'local'], (all) => {
        for (const line of all.split(/\r?\n/)) {
          const event = parseBrowseLine(line);
          if (event?.action === 'add' && !resolving.has(event.name)) resolving.set(event.name, resolveInstance(event.name));
        }
      });
      await Promise.all(resolving.values());
    } finally {
      for (const child of children) child.kill('SIGKILL');
    }
    return dedupe([...found.values()]);
  }
}

/** The same node may appear on several interfaces: deduplicate by `nodeId` (or by name when there is none). */
function dedupe(nodes: DiscoveredNode[]): DiscoveredNode[] {
  const seen = new Set<string>();
  return nodes.filter((node) => {
    const key = node.nodeId ?? `name:${node.name}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

/** Default discovery method for this platform: macOS uses `dns-sd`; other platforms do not browse. */
export function defaultDiscoverer(platform: NodeJS.Platform = process.platform, log?: NodeLogger): Discoverer {
  return platform === 'darwin' ? new DnsSdDiscoverer(log ? { log } : {}) : noDiscoverer;
}
