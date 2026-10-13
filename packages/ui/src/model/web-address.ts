import { safeUrl } from './workspace.ts';

/**
 * The address bar and zoom for web tabs (product design §3.3; ported from the design mockup model-home-browser.js).
 */

/** Input that is not a URL goes to this search engine (mockup: Google). */
export const WEB_SEARCH_URL = 'https://www.google.com/search?q=';

/**
 * Address bar input → the URL to open. Input that looks like a hostname (`a.b`, `localhost`, `[::1]`, optionally with a port) or that has a protocol is treated as a URL.
 * Input that does not follow the rules (not http/https, or with a username or password) returns null. Anything else is a search term. Empty input returns null.
 */
export function resolveAddress(input: string): string | null {
  const text = input.trim();
  if (!text) return null;
  const host = /^(localhost|\[[\da-f:]+\]|[^\s/:?#]+\.[^\s/:?#]+)(?::\d+)?(?:[/?#]|$)/i.test(text);
  if (host || /^[a-z][a-z\d+.-]*:/i.test(text)) return safeUrl(text);
  return WEB_SEARCH_URL + encodeURIComponent(text);
}

/** The URL shown while the address bar is idle: host + path (the root path is omitted) + query + fragment, without the protocol. */
export function displayUrl(url: string): string {
  try {
    const u = new URL(url);
    return u.host + (u.pathname === '/' ? '' : u.pathname) + u.search + u.hash;
  } catch {
    return '';
  }
}

/** Zoom levels (percent): 50–200. */
export const WEB_ZOOM_STEPS = [50, 67, 75, 90, 100, 110, 125, 150, 175, 200] as const;

/** Zoom in (delta > 0) or out by one level. If the current value is not on a level, it moves to the nearest next level. It stops at the ends. */
export function zoomStep(current: number, delta: 1 | -1): number {
  const steps: readonly number[] = WEB_ZOOM_STEPS;
  if (delta > 0) return steps.find((s) => s > current) ?? steps.at(-1)!;
  return [...steps].reverse().find((s) => s < current) ?? steps[0]!;
}

/** How long a page load takes before it counts as “slow”. */
export const WEB_SLOW_MS = 15_000;

export interface WebKeyLike {
  key: string;
  code?: string;
  metaKey: boolean;
  ctrlKey: boolean;
  altKey: boolean;
  shiftKey: boolean;
}

/**
 * Keyboard shortcuts for web tabs (prototype home-browser.jsx): ⌘L focuses the address bar, ⌘R reloads. Windows and Linux use Ctrl.
 * Letter keys are matched by physical key (`code`), so they are recognized even when an input method rewrites `key`.
 */
export function webShortcut(event: WebKeyLike, mac: boolean): 'focus-address' | 'reload' | 'force-reload' | 'find' | null {
  const mod = mac ? event.metaKey && !event.ctrlKey : event.ctrlKey && !event.metaKey;
  if (!mod || event.altKey) return null;
  const letter = event.code?.startsWith('Key') ? event.code.slice(3).toLowerCase() : event.key.toLowerCase();
  if (letter === 'r') return event.shiftKey ? 'force-reload' : 'reload';
  if (event.shiftKey) return null;
  if (letter === 'f') return 'find';
  if (letter === 'l') return 'focus-address';
  return null;
}

export interface DeviceSize { width: number; height: number }
export const DEVICE_PRESETS = { phone: { width: 390, height: 844 }, tablet: { width: 820, height: 1180 }, laptop: { width: 1440, height: 900 } };
export function deviceFrame(size: DeviceSize, available: DeviceSize): DeviceSize {
  const scale = Math.max(0, Math.min(1, (available.width - 32) / size.width, (available.height - 32) / size.height));
  return { width: Math.floor(size.width * scale), height: Math.floor(size.height * scale) };
}
