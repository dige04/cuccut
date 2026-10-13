import { defineMessages, type FileTarget, type Id, type ProjectFileEntry } from '@cuccut/protocol';
import { agoLabel } from './format.ts';
import { KIND_LABEL, formatBytes } from './space.ts';
import { zhHans } from './project-files.zh-Hans.ts';
import { zhHant } from './project-files.zh-Hant.ts';
import { ja } from './project-files.ja.ts';
import { ko } from './project-files.ko.ts';
import { es } from './project-files.es.ts';
import { fr } from './project-files.fr.ts';
import { de } from './project-files.de.ts';
import { nl } from './project-files.nl.ts';
import { ptBR } from './project-files.pt-BR.ts';
import { it } from './project-files.it.ts';
import { ru } from './project-files.ru.ts';
import { pl } from './project-files.pl.ts';
import { tr } from './project-files.tr.ts';
import { vi } from './project-files.vi.ts';

/** Name for entries whose type is not recognized (translations are in `project-files.<lang>.ts`). */
const en = { folder: 'Folder', file: 'File' };
export type ProjectFilesMessages = typeof en;
const M = defineMessages(en, { 'zh-Hans': zhHans, 'zh-Hant': zhHant, ja, ko, es, fr, de, nl, 'pt-BR': ptBR, it, ru, pl, tr, vi });

/**
 * Pure functions for browsing project files (product design §3.3 “Project files” tab): breadcrumbs, the parent level, each row's description text, and the location when opened.
 * Directories are represented as paths relative to the root, `/`-separated; the root is an empty string.
 */

export interface Crumb {
  label: string;
  dir: string;
}

/** Breadcrumbs: the root (showing `rootLabel`) plus each subdirectory level. */
export function breadcrumbs(dir: string, rootLabel: string): Crumb[] {
  const parts = dir.split('/').filter(Boolean);
  return [{ label: rootLabel, dir: '' }, ...parts.map((label, i) => ({ label, dir: parts.slice(0, i + 1).join('/') }))];
}

/** The parent directory; returns null when already at the root. */
export function parentDir(dir: string): string | null {
  const parts = dir.split('/').filter(Boolean);
  return parts.length ? parts.slice(0, -1).join('/') : null;
}

/** The directory the entry is in (shown below the name in search results); an empty string at the root. */
export function entryFolder(path: string): string {
  const slash = path.lastIndexOf('/');
  return slash > 0 ? path.slice(0, slash) : '';
}

/** Description of a row: type (unrecognized files are called “File”) · size · modified time. */
export function entryMeta(entry: ProjectFileEntry, now = Date.now()): string {
  const kind = entry.kind ? KIND_LABEL[entry.kind] : entry.isDir ? M.folder : M.file;
  const parts = [kind];
  if (entry.size !== null) parts.push(formatBytes(entry.size));
  if (entry.modifiedAt) parts.push(agoLabel(entry.modifiedAt, now));
  return parts.join(' · ');
}

/** Location handed over when an entry is opened: the path relative to the session working directory (same format as `media.resolve`). */
export function projectFileTarget(conversationId: Id, entry: Pick<ProjectFileEntry, 'path'>): FileTarget {
  return { conversationId, path: entry.path };
}

/**
 * Video directories go to the video viewer, slide directories to the slides tab (docs/design/slides §8.1), design-draft directories to the design tab (docs/design/canvas §8.1),
 * and design-system directories to the design-system tab (§10). Ordinary directories are entered; the rest are files.
 */
export function entryAction(
  entry: Pick<ProjectFileEntry, 'isDir' | 'kind'>,
): 'video' | 'slides' | 'design' | 'design-system' | 'enter' | 'file' {
  if (entry.kind === 'video') return 'video';
  if (entry.kind === 'slides') return 'slides';
  if (entry.kind === 'design') return 'design';
  if (entry.kind === 'design-system') return 'design-system';
  return entry.isDir ? 'enter' : 'file';
}
