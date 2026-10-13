import { useEffect } from 'react';
import type { CaptionItem, DocumentRecord, Id, Sequence } from '@cuccut/protocol';
import { captionChips, captionKind, onScreen, type CaptionChip } from '../../model/caption-tracks.ts';
import { DEFAULT_CAPTION_STYLE, captionStyleRoot } from '../../model/property-values.ts';
import type { Json, LineKind } from '../../render/text-style.ts';
import { useEditor } from '../../state/editor-store.ts';
import { draftedBody, dropStaleDraft } from './draft-documents.ts';
import { useDocumentBody } from './use-document-body.ts';

export interface CaptionStyleState {
  /** Caption style document. Does not exist while captions still use the default style (created on the first edit). */
  record: DocumentRecord | undefined;
  /** Body with the draft overlaid; undefined before it is fetched. */
  body: unknown;
  /** Studio root style; null when the body is not yet fetched or the style format is not recognized. */
  root: Json | null;
  /** The caption track chip this item belongs to. */
  chip: CaptionChip | undefined;
  /** Whether this item is the original or the translation. */
  own: LineKind;
  /** Captions on screen that use this style. When there is no style yet: those that also have none, can be edited, and will be attached together on the first edit. */
  sharing: CaptionChip[];
  /** Original and translation share this style, stacked as two bilingual lines. */
  paired: boolean;
}

/**
 * Style document for a caption (shared by the caption property page and the caption toolbar on the stage): overlays the draft being dragged, and when a new body version arrives, discards the old draft. This style governs which kinds of line: when both original and translation exist, it is two bilingual lines.
 */
export function useCaptionStyle(item: CaptionItem, sequence: Sequence, documents: Record<Id, DocumentRecord>): CaptionStyleState {
  const record = item.styleDocumentId ? documents[item.styleDocumentId] : undefined;
  const loaded = useDocumentBody(record);
  const draft = useEditor((s) => s.documentDraft);
  const body = record ? draftedBody(draft, record.id, record.currentRevision, loaded) : DEFAULT_CAPTION_STYLE;
  useEffect(() => {
    if (record) dropStaleDraft(record.id, record.currentRevision, loaded);
  }, [record, loaded]);
  const root = body === undefined ? null : captionStyleRoot(body);

  const chips = captionChips(sequence, documents);
  const chip = chips.find((c) => c.itemIds.includes(item.id));
  const own = captionKind(item.documentId, documents);
  const sharing = onScreen(chips).filter((c) =>
    item.styleDocumentId ? c.styleDocumentId === item.styleDocumentId : !c.styleDocumentId && !c.locked,
  );
  const paired = new Set<LineKind>([own, ...sharing.map((c) => c.kind)]).size > 1;
  return { record, body, root, chip, own, sharing, paired };
}
