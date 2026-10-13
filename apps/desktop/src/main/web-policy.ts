/**
 * Rules for web tabs (architecture design §12.10): which addresses may open, which requests are blocked, zoom levels, and how the parameters the renderer process passes in are validated.
 * Pure logic that does not import electron, so it can be unit-tested; the parts that hook into Electron live in web-tabs.ts.
 */

/** Reasons for rejection: not a URL, not http/https, a local loopback address, or the app's own page. */
export type WebBlockReason = 'invalid' | 'scheme' | 'loopback' | 'app-origin';

export type WebUrlCheck = { ok: true; url: string } | { ok: false; reason: WebBlockReason };

export interface WebUrlOptions {
  /** The app's own origin (the renderer dev server during development). */
  appOrigins?: readonly string[];
  /** Allows loopback addresses: only for the UI's own “open in browser” action; anything initiated by a web page is never allowed. */
  allowLoopback?: boolean;
}

/**
 * Local loopback addresses: localhost (including `*.localhost`), 127.0.0.0/8, 0.0.0.0, [::1], [::], and their IPv6-mapped forms.
 * The input is `URL.hostname`: URL parsing has already normalized forms such as `127.1`, `0x7f.0.0.1` and `2130706433` to `127.0.0.1`.
 */
export function isLoopbackHost(hostname: string): boolean {
  const host = hostname.toLowerCase().replace(/\.$/, '');
  if (host === 'localhost' || host.endsWith('.localhost')) return true;
  if (/^127\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(host) || host === '0.0.0.0') return true;
  if (!host.startsWith('[')) return false;
  const v6 = host.slice(1, -1);
  // After normalization, `::ffff:127.0.0.1` becomes `::ffff:7f00:1`; `::127.0.0.1` (a deprecated compatible form) becomes `::7f00:1`.
  return v6 === '::1' || v6 === '::' || v6 === '::ffff:0:0' || /^::(ffff:)?7f[0-9a-f]{2}:[0-9a-f]{1,4}$/.test(v6);
}

/** The URL with the username and password removed. */
function withoutCredentials(url: URL): string {
  url.username = '';
  url.password = '';
  return url.href;
}

/** Whether a web tab may open this address: only http/https is allowed, loopback addresses and the app's own pages are rejected, and the username and password are stripped. */
export function checkWebUrl(raw: unknown, options: WebUrlOptions = {}): WebUrlCheck {
  if (typeof raw !== 'string' || raw.length === 0 || raw.length > 8192) return { ok: false, reason: 'invalid' };
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    return { ok: false, reason: 'invalid' };
  }
  if (url.protocol !== 'http:' && url.protocol !== 'https:') return { ok: false, reason: 'scheme' };
  if (!url.hostname) return { ok: false, reason: 'invalid' };
  if (options.appOrigins?.includes(url.origin)) return { ok: false, reason: 'app-origin' };
  if (!options.allowLoopback && isLoopbackHost(url.hostname)) return { ok: false, reason: 'loopback' };
  return { ok: true, url: withoutCredentials(url) };
}

/**
 * Every request in the web partition (including subframes, images, scripts and WebSockets): network requests are checked with `checkWebUrl`;
 * `data:`, `blob:` and `about:` and similar schemes that do not reach the network are allowed; `file:` and other protocols are always blocked.
 */
export function isRequestAllowed(raw: string, appOrigins: readonly string[] = []): boolean {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    return false;
  }
  switch (url.protocol) {
    case 'http:':
    case 'https:':
      return checkWebUrl(raw, { appOrigins }).ok;
    case 'ws:':
    case 'wss:':
      return !isLoopbackHost(url.hostname) && !appOrigins.includes(url.origin.replace(/^ws/, 'http'));
    case 'data:':
    case 'blob:':
    case 'about:':
      return true;
    default:
      return false;
  }
}

/** Zoom levels (percentages), matching the design spec; range 50–200. */
export const WEB_ZOOM_MIN = 50;
export const WEB_ZOOM_MAX = 200;

/** Clamps the zoom percentage given by the renderer process into the range; returns null if it is not a finite number. */
export function clampZoom(percent: unknown): number | null {
  if (typeof percent !== 'number' || !Number.isFinite(percent)) return null;
  return Math.min(WEB_ZOOM_MAX, Math.max(WEB_ZOOM_MIN, Math.round(percent)));
}

export interface WebBounds {
  x: number;
  y: number;
  width: number;
  height: number;
}

const MAX_COORD = 100_000;

/** The web view's rectangle within the window: four finite numbers; rounded to integers (Electron does not accept fractions); width and height cannot be negative. */
export function parseBounds(raw: unknown): WebBounds | null {
  if (!raw || typeof raw !== 'object') return null;
  const { x, y, width, height } = raw as Record<string, unknown>;
  const values = [x, y, width, height];
  if (!values.every((v) => typeof v === 'number' && Number.isFinite(v) && Math.abs(v) <= MAX_COORD)) return null;
  const [rx, ry, rw, rh] = (values as number[]).map(Math.round) as [number, number, number, number];
  if (rw < 0 || rh < 0) return null;
  return { x: rx, y: ry, width: rw, height: rh };
}

/** Web tab IDs are generated by the main process; an ID passed back from the renderer process is first checked for shape. */
export function isWebTabId(raw: unknown): raw is string {
  return typeof raw === 'string' && /^web_[A-Za-z0-9_-]{1,60}$/.test(raw);
}

export function parseDeviceSize(raw: unknown): { width: number; height: number } | null {
  if (!raw || typeof raw !== 'object') return null;
  const { width, height } = raw as Record<string, unknown>;
  if (![width, height].every(n => typeof n === 'number' && Number.isFinite(n) && n >= 240 && n <= 4096)) return null;
  return { width: Math.round(width as number), height: Math.round(height as number) };
}

export function parseFindRequest(raw: unknown): { query: string; forward: boolean; next: boolean } | null {
  if (!raw || typeof raw !== 'object') return null;
  const { query, forward, next } = raw as Record<string, unknown>;
  if (typeof query !== 'string' || !query || query.length > 4096 || query.includes('\0')) return null;
  return { query, forward: forward !== false, next: next === true };
}

export function nativeWebShortcut(input: { key: string; code?: string; meta: boolean; control: boolean; alt: boolean; shift: boolean }, mac: boolean) {
  if (input.alt || (mac ? !input.meta || input.control : !input.control || input.meta)) return null;
  const key = (input.code?.startsWith('Key') ? input.code.slice(3) : input.key).toLowerCase();
  if (key === 'r') return input.shift ? 'force-reload' as const : 'reload' as const;
  if (input.shift) return null;
  return key === 'l' ? 'focus-address' as const : key === 'f' ? 'find' as const : null;
}

/**
 * User-Agent used by web tabs: strips Electron and the app name so that sites do not treat it as “not a browser”.
 * `… (KHTML, like Gecko) CucCut/0.1.0 Chrome/140.0 Electron/44.5.1 Safari/537.36` → `… (KHTML, like Gecko) Chrome/140.0 Safari/537.36`
 */
export function browserUserAgent(ua: string): string {
  return ua.replace(/(\(KHTML, like Gecko\)) (?:\S+ )*?(Chrome\/)/, '$1 $2').replace(/ Electron\/\S+/, '');
}

/** Throttle for handing web pop-ups to the system browser: each tab passes one through per period, blocking a stream of pop-ups. */
export class OpenThrottle {
  readonly #intervalMs: number;
  readonly #last = new Map<string, number>();

  constructor(intervalMs = 1000) {
    this.#intervalMs = intervalMs;
  }

  allow(key: string, now: number): boolean {
    const last = this.#last.get(key);
    if (last !== undefined && now - last < this.#intervalMs) return false;
    this.#last.set(key, now);
    return true;
  }

  forget(key: string): void {
    this.#last.delete(key);
  }
}
