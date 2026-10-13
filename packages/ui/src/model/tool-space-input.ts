import { defineMessages, live, type Id, type SpaceEntry, type SpaceEntryKind, type ToolInputKind } from '@cuccut/protocol';
import { KIND_LABEL } from './space.ts';
import { spaceKindsOf, TOOLS, type ToolId } from './tool-catalog.ts';
import type { PickerRow } from './tool-targets.ts';
import { zhHans } from './tool-space-input.zh-Hans.ts';
import { zhHant } from './tool-space-input.zh-Hant.ts';
import { ja } from './tool-space-input.ja.ts';
import { ko } from './tool-space-input.ko.ts';
import { es } from './tool-space-input.es.ts';
import { fr } from './tool-space-input.fr.ts';
import { de } from './tool-space-input.de.ts';
import { nl } from './tool-space-input.nl.ts';
import { ptBR } from './tool-space-input.pt-BR.ts';
import { it } from './tool-space-input.it.ts';
import { ru } from './tool-space-input.ru.ts';
import { pl } from './tool-space-input.pl.ts';
import { tr } from './tool-space-input.tr.ts';
import { vi } from './tool-space-input.vi.ts';

export { spaceKindsOf };

/**
 * Space items as tool inputs (product design §2.7 “pages” item 1, §4.5 “Process with tool…”; architecture design §7.9 “Space items as input”; design file model-tool-space-input.js). Pure functions.
 *
 * Which tool accepts which item kinds is declared once, in the tool catalog (`kinds` of the inputs in model/tool-catalog.ts), and both directions derive from it: tool → items (the candidates in the Space picker) and item → tools (the viewer’s “Process with tool…”). The kinds are a subset of what Runtime accepts when it resolves `{ entryId }` (runtime-core space-inputs.ts: media means video assets, finished videos, and audio; caption-file translation means captions; material means documents and captions). `video` is an editable video; its candidates come separately from `tools.candidates` (which carry the transcript).
 */

/** Why an item cannot be chosen (translations are in `tool-space-input.<lang>.ts`). */
const en = {
  reasons: {
    trashed: 'In the Trash',
    generating: 'Still generating; you can choose it when it’s done',
    missing: 'The file is missing; reconnect it before choosing',
    failed: 'The last generation failed',
    textOnly: 'Only text from .txt and .md documents can be read',
    subtitleOnly: 'Only .srt and .vtt subtitles are accepted',
    noPath: 'This item has no file on this computer; a new video has to start from a local file',
  },
  joinKinds: (labels: readonly string[]) => labels.join(', '),
};
export type ToolSpaceInputMessages = typeof en;
const M = defineMessages(en, { 'zh-Hans': zhHans, 'zh-Hant': zhHant, ja, ko, es, fr, de, nl, 'pt-BR': ptBR, it, ru, pl, tr, vi });

export const SPACE_INPUT_COPY: ToolSpaceInputMessages['reasons'] = live(() => M.reasons);

/** “video, video material, finished video, audio”. */
export function spaceKindsText(tool: ToolId): string {
  return M.joinKinds(spaceKindsOf(tool).map((k) => KIND_LABEL[k]));
}

function extOf(entry: Pick<SpaceEntry, 'fileName' | 'name'>): string {
  const name = entry.fileName || entry.name;
  const dot = name.lastIndexOf('.');
  return dot < 0 ? '' : name.slice(dot + 1).toLowerCase();
}

/** Why the item itself cannot be used as input (the part that is independent of tools). null when usable. Mismatched kinds are not here; they are not listed. */
export function entryReason(entry: SpaceEntry): string | null {
  if (entry.user.trashedAt) return SPACE_INPUT_COPY.trashed;
  if (entry.status === 'generating') return SPACE_INPUT_COPY.generating;
  if (entry.status === 'missing') return SPACE_INPUT_COPY.missing;
  if (entry.status === 'failed') return SPACE_INPUT_COPY.failed;
  if (entry.kind === 'document' && !['txt', 'md', 'markdown'].includes(extOf(entry))) return SPACE_INPUT_COPY.textOnly;
  if (entry.kind === 'subtitle' && !['srt', 'vtt'].includes(extOf(entry))) return SPACE_INPUT_COPY.subtitleOnly;
  return null;
}

/** One row of the Space picker. Video rows carry the candidates from `tools.candidates` (transcript, labels, greyed-out reason); other rows carry items. */
export interface SpaceRow {
  entryId: Id;
  name: string;
  kind: SpaceEntryKind;
  kindLabel: string;
  lastActivityAt: string;
  eligible: boolean;
  reason: string | null;
  entry: SpaceEntry | null;
  video: PickerRow | null;
}

function matches(name: string, query: string): boolean {
  const q = query.trim().toLowerCase();
  return !q || name.toLowerCase().includes(q);
}

/**
 * Candidates for a tool in Space: only the kinds this tool accepts are listed, and trashed items are not. Selectable ones come first; within each group, the most recent activity comes first. Video rows come from `videoRows` (the rows of `tools.candidates`; the caller has already filtered them by search term). The rest come from the items in the Space directory.
 */
export function spaceRows(tool: ToolId, entries: readonly SpaceEntry[], videoRows: readonly PickerRow[], query = ''): SpaceRow[] {
  const kinds = spaceKindsOf(tool);
  const byId = new Map(entries.map((e) => [e.id, e]));
  const rows: SpaceRow[] = [];
  if (kinds.includes('video')) {
    for (const v of videoRows) {
      rows.push({
        entryId: v.entryId,
        name: v.name,
        kind: 'video',
        kindLabel: KIND_LABEL.video,
        lastActivityAt: v.lastActivityAt,
        eligible: v.eligible,
        reason: v.reason,
        entry: byId.get(v.entryId) ?? null,
        video: v,
      });
    }
  }
  for (const e of entries) {
    if (e.kind === 'video' || !kinds.includes(e.kind) || e.user.trashedAt || !matches(e.name, query)) continue;
    const reason = entryReason(e);
    rows.push({ entryId: e.id, name: e.name, kind: e.kind, kindLabel: KIND_LABEL[e.kind], lastActivityAt: e.lastActivityAt, eligible: !reason, reason, entry: e, video: null });
  }
  return rows.sort(
    (a, b) => Number(b.eligible) - Number(a.eligible) || (a.lastActivityAt < b.lastActivityAt ? 1 : a.lastActivityAt > b.lastActivityAt ? -1 : 0),
  );
}

/**
 * The input kind an selected item is submitted as (`tools.list` availability and `executionByInput` select by it): an editable video is written into (`video`); generated speech, and documents and captions from text generation, are material (`document`); everything else is used as a file (`file`).
 */
export function inputKindOf(tool: ToolId, kind: SpaceEntryKind): ToolInputKind {
  if (kind === 'video') return 'video';
  return tool === 'synthesize-speech' || tool === 'generate-text' ? 'document' : 'file';
}

/** Items → the tools that accept them (the Space viewer’s “Process with tool…”, §4.5), in catalog order. Trashed items have none. */
export function toolsForEntry(entry: Pick<SpaceEntry, 'kind' | 'user'>): ToolId[] {
  if (entry.user.trashedAt) return [];
  return TOOLS.filter((t) => !t.planned && spaceKindsOf(t.id).includes(entry.kind)).map((t) => t.id);
}
