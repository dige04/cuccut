import type { FileTarget, SpaceEntry } from '@cuccut/protocol';
import { entryOfTarget } from './workspace.ts';

/** Swap loopback hostnames (docs/design/canvas §6.2): when the UI is on `127.0.0.1`, the editor uses `localhost`, and vice versa. */
const OTHER_LOOPBACK: Record<string, string> = { '127.0.0.1': 'localhost', localhost: '127.0.0.1' };

/**
 * The address of the design and design-system editor iframes. On desktop, `design.open` / `designSystem.open` give absolute gateway addresses, used as is. The web service gives relative addresses `/design/<grant>/` and `/design-system/<grant>/`. Switching those to the other loopback hostname has no session cookie there, so the artboard script cannot connect to the Runtime (§6.2 D2, §10.4). When the page is not on these two hostnames, it cannot be switched: return null, the tab shows an unavailable note, and it does not fall back to same-origin.
 */
export function designFrameUrl(address: string, location: Pick<Location, 'protocol' | 'hostname' | 'port'>): string | null {
  if (!address.startsWith('/')) return address;
  const other = OTHER_LOOPBACK[location.hostname];
  if (!other) return null;
  return `${location.protocol}//${other}${location.port ? `:${location.port}` : ''}${address}`;
}

/** The design-system directory parameter on the design-system editor address (docs/design/canvas §10.4): the editor's prompt to the agent uses it to say which design system it means. */
export const DESIGN_SYSTEM_PATH_PARAM = 'path';

/**
 * The `path` added to the design-system editor address: `FileTarget.path`. When opened from a Space item, it is the item's relative path in the source directory.
 * When the item is not found, or is not in the source directory, return null and leave it off the address.
 */
export function designSystemPath(target: FileTarget, entries: readonly SpaceEntry[]): string | null {
  if ('path' in target) return target.path;
  const entry = entryOfTarget(entries, target);
  // An entry outside the source directory: relPath is only a display name
  return entry && (entry.source.projectId || entry.source.conversationId) ? entry.relPath : null;
}
