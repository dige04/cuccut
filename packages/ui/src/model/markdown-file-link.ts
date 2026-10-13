import type { FileTarget, MediaTarget, SpaceEntry } from '@cuccut/protocol';
import { entryPath, previewModeOfFileName } from './space.ts';

/** Explicit file links in Markdown allow spaces, bare file names and any extension; web pages, settings routes and anchors are not treated as files. */
export function markdownFilePath(href: string): string | null {
  let raw = href.trim();
  if (!raw || /[\u0000-\u001f\u007f]/.test(raw) || /^(?:#|\?|\/\/)/.test(raw)) return null;
  if (/^file:/i.test(raw)) {
    try {
      const url = new URL(raw);
      if (url.hostname && url.hostname !== 'localhost') return null;
      raw = url.pathname.replace(/^\/([a-z]:\/)/i, '$1');
    } catch {
      return null;
    }
  } else {
    if (/^[a-z][a-z\d+.-]*:/i.test(raw) && !/^[a-z]:[\\/]/i.test(raw)) return null;
    raw = raw.split(/[?#]/, 1)[0]!;
  }
  try {
    raw = decodeURIComponent(raw);
  } catch {
    return null;
  }
  if (!raw || /[\u0000-\u001f\u007f]/.test(raw) || /^\/settings(?:\/|$)/.test(raw)) return null;
  raw = raw.replace(/:(\d+)(?:-\d+|:\d+)?$/, '');
  return raw || null;
}

/** Used only to match the directory mirror; it does not replace the Runtime's real path and permission checks. */
export function markdownAbsolutePath(path: string, cwd: string | null): string | null {
  let value = path.replaceAll('\\', '/');
  if (!/^(?:\/|[a-z]:\/)/i.test(value)) {
    if (!cwd) return null;
    value = `${cwd.replaceAll('\\', '/')}/${value}`;
  }
  const drive = /^[a-z]:\//i.test(value) ? value.slice(0, 2).toLowerCase() : '';
  const parts: string[] = [];
  for (const part of value.slice(drive.length).split('/')) {
    if (part === '..') parts.pop();
    else if (part && part !== '.') parts.push(part);
  }
  return `${drive}/${parts.join('/')}`;
}

/** Deliverables in the download directory must be opened by their Space entry; session path handles still allow access only to the working directory. */
export function markdownFileTarget(
  path: string,
  scope: { conversationId: string; cwd: string | null },
  entries: readonly SpaceEntry[],
  dirs: Parameters<typeof entryPath>[1],
): FileTarget {
  const absolute = markdownAbsolutePath(path, scope.cwd);
  const entry = absolute ? entries.find((entry) => {
    if (entry.user.trashedAt !== null || entry.kind === 'video') return false;
    const file = entryPath(entry, dirs);
    return file !== null && markdownAbsolutePath(file, null) === absolute;
  }) : undefined;
  return entry ? { entryId: entry.id } : { conversationId: scope.conversationId, path };
}

export function markdownFileOutsideScope(path: string, cwd: string | null): boolean {
  const absolute = markdownAbsolutePath(path, cwd);
  const root = cwd ? markdownAbsolutePath(cwd, null) : null;
  return absolute !== null && (root === null || (absolute !== root && !absolute.startsWith(`${root.replace(/\/$/, '')}/`)));
}

/** What happens when a file link (or an inline path) in a reply is clicked: a file tab in the side panel, or the system's default app. */
export type MarkdownOpenAction = { kind: 'pane'; target: MediaTarget } | { kind: 'system'; path: string };

/**
 * File links in replies (product design §3.2.2): registered deliverables open by their entry; those in the working directory open by session path. Those outside the working directory with no entry:
 * on the desktop, they are previewed read-only in a file tab by local path (`{ localPath }`, which the Runtime grants only to the desktop client); only types the viewer does not support are handed to the system's default app;
 * the browser has no such capability, so it still requests by session path as before, and the Runtime's access scope reports it as unavailable in the viewer.
 */
export function markdownOpenAction(
  path: string,
  scope: { conversationId: string; cwd: string | null },
  entries: readonly SpaceEntry[],
  dirs: Parameters<typeof entryPath>[1],
  host: { desktop: boolean },
): MarkdownOpenAction {
  const target = markdownFileTarget(path, scope, entries, dirs);
  if ('entryId' in target || !host.desktop || !markdownFileOutsideScope(path, scope.cwd)) return { kind: 'pane', target };
  const absolute = markdownAbsolutePath(path, scope.cwd)!;
  // When a local path is handed to the Runtime, keep its original form (drive letter and backslashes on Windows); only relative paths are completed.
  const local = /^(?:\/|[a-z]:[\\/]|\\\\)/i.test(path) ? path : absolute;
  const name = absolute.slice(absolute.lastIndexOf('/') + 1);
  return previewModeOfFileName(name) ? { kind: 'pane', target: { localPath: local } } : { kind: 'system', path: absolute };
}
