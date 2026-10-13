import { defineMessages, type CaptionItem, type DocumentRecord, type EditOperation, type Id, type Sequence } from '@cuccut/protocol';
import { zhHans } from './caption-tracks.zh-Hans.ts';
import { zhHant } from './caption-tracks.zh-Hant.ts';
import { ja } from './caption-tracks.ja.ts';
import { ko } from './caption-tracks.ko.ts';
import { es } from './caption-tracks.es.ts';
import { fr } from './caption-tracks.fr.ts';
import { de } from './caption-tracks.de.ts';
import { nl } from './caption-tracks.nl.ts';
import { ptBR } from './caption-tracks.pt-BR.ts';
import { it } from './caption-tracks.it.ts';
import { ru } from './caption-tracks.ru.ts';
import { pl } from './caption-tracks.pl.ts';
import { tr } from './caption-tracks.tr.ts';
import { vi } from './caption-tracks.vi.ts';

/** Copy for the caption track strip (the English is the source of keys and types; the translations live in `caption-tracks.zh-Hans.ts`). */
const en = {
  translation: 'Translation',
  original: 'Original',
  withName: (label: string, name: string) => `${label} (${name})`,
};
export type CaptionTracksMessages = typeof en;
const M = defineMessages(en, { 'zh-Hans': zhHans, 'zh-Hant': zhHant, ja, ko, es, fr, de, nl, 'pt-BR': ptBR, it, ru, pl, tr, vi });

/**
 * The track strip at the top of the caption panel (prototype `SubTrackStrip` in panel-substrip.jsx and `useSubTrackOps` in subtrack.jsx):
 * which caption documents are on screen, one chip each. × takes one off screen (`updateItem enabled: false`, data is not deleted).
 * A removed one becomes a dashed ghost chip, and clicking it puts it back. Removing the last one on screen is refused; putting one back asks for confirmation once there are already two or more on screen.
 *
 * A chip is "one caption document on one caption track": usually that is one caption instance. When a caption instance is split into several segments, those segments count as one chip, and removing or restoring them happens together.
 */

export type ChipState =
  /** On screen. */
  | 'on'
  /** On screen, but its caption track is disabled in the timeline track header (`visible: false`). */
  | 'off'
  /** Taken off screen (instance `enabled: false`). */
  | 'shelved';

export interface CaptionChip {
  key: string;
  documentId: Id;
  trackId: Id;
  /** Sorted by start time; the first one is the edit target when selected. */
  itemIds: Id[];
  kind: 'original' | 'translation';
  /** Label on the chip: the source text is written “原文” (source), and a translation is written as its language name, in that language's own spelling. */
  label: string;
  /** Full name used in hints (the document name). */
  name: string;
  state: ChipState;
  /** The instance or its track is locked: the engine rejects both removing and restoring. */
  locked: boolean;
  styleDocumentId?: Id;
}

/** Whether a caption line is source or translation: decided by which kind of document the caption document derives from (same check as the preview and the properties page). */
export function captionKind(documentId: Id, documents: Record<Id, DocumentRecord>): 'original' | 'translation' {
  const record = documents[documentId];
  const parent = record?.sourceDocumentId ? documents[record.sourceDocumentId] : undefined;
  return parent?.kind === 'translation' ? 'translation' : 'original';
}

/** Labels for source and translation (hover text on the timeline caption track headers). */
export function captionKindLabel(kind: 'original' | 'translation'): string {
  return kind === 'translation' ? M.translation : M.original;
}

/** Language tag → the language's own name (`en` → English, `ja` → 日本語); returns the input unchanged when the tag is not recognised. */
export function languageName(tag: string): string {
  try {
    const name = new Intl.DisplayNames([tag], { type: 'language' }).of(tag);
    return name ? name.charAt(0).toLocaleUpperCase(tag) + name.slice(1) : tag;
  } catch {
    return tag;
  }
}

/** Captions on the sequence: sorted by track order, then by start time. */
export function captionChips(sequence: Sequence, documents: Record<Id, DocumentRecord>): CaptionChip[] {
  const tracks = new Map(sequence.tracks.map((track) => [track.id, track]));
  const items = sequence.items
    .filter((item): item is CaptionItem => item.type === 'caption' && !!documents[item.documentId])
    .sort((a, b) => (tracks.get(a.trackId)?.order ?? 0) - (tracks.get(b.trackId)?.order ?? 0) || a.span.fromFrame - b.span.fromFrame);
  const groups = new Map<string, CaptionItem[]>();
  for (const item of items) {
    const key = `${item.trackId}:${item.documentId}`;
    groups.set(key, [...(groups.get(key) ?? []), item]);
  }
  const chips = [...groups].map(([key, members]): CaptionChip => {
    const first = members[0]!;
    const record = documents[first.documentId]!;
    const track = tracks.get(first.trackId);
    const kind = captionKind(first.documentId, documents);
    const enabled = members.filter((item) => item.enabled);
    const style = members.find((item) => item.styleDocumentId)?.styleDocumentId;
    return {
      key,
      documentId: first.documentId,
      trackId: first.trackId,
      itemIds: members.map((item) => item.id),
      kind,
      label: kind === 'translation' ? (record.language ? languageName(record.language) : M.translation) : M.original,
      name: record.name,
      state: enabled.length === 0 ? 'shelved' : track && !track.visible ? 'off' : 'on',
      locked: !!track?.locked || members.some((item) => item.locked),
      ...(style ? { styleDocumentId: style } : {}),
    };
  });
  // Same-named ones get the document name added; ones that still cannot be told apart are numbered in order.
  const counts = (list: readonly CaptionChip[]) => {
    const map = new Map<string, number>();
    for (const chip of list) map.set(chip.label, (map.get(chip.label) ?? 0) + 1);
    return map;
  };
  const named = counts(chips);
  const withNames = chips.map((chip) => ((named.get(chip.label) ?? 0) > 1 ? { ...chip, label: M.withName(chip.label, chip.name) } : chip));
  const still = counts(withNames);
  const seen = new Map<string, number>();
  return withNames.map((chip) => {
    if ((still.get(chip.label) ?? 0) < 2) return chip;
    const n = (seen.get(chip.label) ?? 0) + 1;
    seen.set(chip.label, n);
    return n > 1 ? { ...chip, label: `${chip.label} ${n}` } : chip;
  });
}

/** Still on screen (including those whose track is disabled). */
export function onScreen(chips: readonly CaptionChip[]): CaptionChip[] {
  return chips.filter((chip) => chip.state !== 'shelved');
}

const toggle = (sequence: Sequence, chip: CaptionChip, enabled: boolean): EditOperation[] =>
  chip.itemIds.map((itemId) => ({ type: 'updateItem', sequenceId: sequence.id, itemId, enabled }));

/** Removing: refused when this is the only one left on screen (hiding all captions is “隐藏字幕” (hide captions), handled elsewhere, not here). */
export function dropOperations(sequence: Sequence, chips: readonly CaptionChip[], chip: CaptionChip): { refused: 'last' } | { operations: EditOperation[] } {
  if (onScreen(chips).filter((other) => other.key !== chip.key).length === 0) return { refused: 'last' };
  return { operations: toggle(sequence, chip, false) };
}

/** Restoring: asks for confirmation first when two or more are already on screen (`confirm` is the count after restoring). */
export function putBackOperations(sequence: Sequence, chips: readonly CaptionChip[], chip: CaptionChip): { confirm: number | null; operations: EditOperation[] } {
  const showing = onScreen(chips).filter((other) => other.key !== chip.key).length;
  return { confirm: showing >= 2 ? showing + 1 : null, operations: toggle(sequence, chip, true) };
}

/**
 * The style document that “倒转 ⇅” (invert) acts on: when the source and translation are stacked in the same style on screen (the preview groups and stacks lines by style document), invert changes that style's
 * `order` (translation on top / source on top, the same field as “双语次序” (bilingual order) on the properties page). Returns null when there is no such group.
 */
export function flipTarget(chips: readonly CaptionChip[]): Id | null {
  const byStyle = new Map<Id, Set<CaptionChip['kind']>>();
  for (const chip of onScreen(chips)) {
    if (!chip.styleDocumentId || chip.state !== 'on') continue;
    byStyle.set(chip.styleDocumentId, (byStyle.get(chip.styleDocumentId) ?? new Set()).add(chip.kind));
  }
  for (const [id, kinds] of byStyle) if (kinds.size > 1) return id;
  return null;
}
