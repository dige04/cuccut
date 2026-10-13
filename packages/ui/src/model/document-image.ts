import type { MediaTarget, SpaceEntry } from '@cuccut/protocol';
import { markdownAbsolutePath } from './markdown-file-link.ts';
import { entryPath } from './space.ts';

/**
 * Relative-path images in Markdown articles in the file viewer (architecture design §12 “文件查看器” (file viewer)). They are resolved to the same kind of media location based on the article's directory, then `media.resolve` gets a restricted handle. The Runtime checks permissions.
 *
 * - Only relative paths are handled (`a.png`, `./img/a.png`, `../a.png`). Paths with a scheme (`http:`, `data:`, `file:`), protocol-relative paths and absolute paths return null, and the caller handles them as before. An article's reference never reads an arbitrary local file.
 * - If the article is a path in a session or project, it resolves against the same source, next to adjacent paths. If the article is a Space item, it resolves against the item's source directory. Deliverables outside that directory first look for an entry registered in the same directory, and desktop falls back to the local path (`{ localPath }`). If the article is a local file, it resolves to the local path in the same directory. Assets and attachments have no directory.
 */
export function siblingMediaTarget(
  base: MediaTarget,
  src: string,
  context: { entries: readonly SpaceEntry[]; dirs: Parameters<typeof entryPath>[1]; desktop: boolean },
): MediaTarget | null {
  const rel = relativeImagePath(src);
  if (rel === null) return null;
  if ('conversationId' in base && 'path' in base) return { conversationId: base.conversationId, path: join(dirOf(base.path), rel) };
  if ('projectId' in base) return { projectId: base.projectId, path: join(dirOf(base.path), rel) };
  if ('localPath' in base) return { localPath: join(dirOf(base.localPath), rel, separatorOf(base.localPath)) };
  if (!('entryId' in base)) return null;
  const entry = context.entries.find((e) => e.id === base.entryId);
  if (!entry) return null;
  const relPath = join(dirOf(entry.relPath), rel);
  if (entry.source.projectId) return { projectId: entry.source.projectId, path: relPath };
  if (entry.source.conversationId) return { conversationId: entry.source.conversationId, path: relPath };
  const file = entry.file?.path;
  if (!file) return null;
  const sibling = join(dirOf(file), rel, separatorOf(file));
  const absolute = markdownAbsolutePath(sibling, null);
  const registered = context.entries.find((e) => {
    if (e.user.trashedAt !== null || e.kind === 'video') return false;
    const path = entryPath(e, context.dirs);
    return path !== null && markdownAbsolutePath(path, null) === absolute;
  });
  if (registered) return { entryId: registered.id };
  return context.desktop ? { localPath: sibling } : null;
}

/** Relative path: strip `?` and `#`, then percent-decode. null when it is not a relative path. */
export function relativeImagePath(src: string): string | null {
  const raw = src.trim();
  if (!raw || /[\u0000-\u001f\u007f]/.test(raw)) return null;
  // Paths with a scheme (including Windows drive letters), protocol-relative paths, root paths and UNC paths are not relative paths.
  if (/^[a-z][a-z\d+.-]*:/i.test(raw) || /^[\\/]/.test(raw)) return null;
  let path = raw.split(/[?#]/, 1)[0]!;
  try {
    path = decodeURIComponent(path);
  } catch {
    return null;
  }
  if (!path || /[\u0000-\u001f\u007f]/.test(path) || /^[\\/]/.test(path) || /^[a-z]:/i.test(path)) return null;
  return path.replace(/^(?:\.[\\/])+/, '');
}

function dirOf(path: string): string {
  return path.slice(0, Math.max(path.lastIndexOf('/'), path.lastIndexOf('\\')) + 1);
}

function separatorOf(path: string): '/' | '\\' {
  return /^[a-z]:\\|^\\\\/i.test(path) && !path.includes('/') ? '\\' : '/';
}

function join(dir: string, rel: string, separator: '/' | '\\' = '/'): string {
  const tail = separator === '\\' ? rel.replaceAll('/', '\\') : rel.replaceAll('\\', '/');
  return `${dir}${tail}`;
}
