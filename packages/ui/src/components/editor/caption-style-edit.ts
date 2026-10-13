import type { DocumentRecord, EditOperation, Localized, Sequence, TransactionReceipt } from '@cuccut/protocol';
import { withCaptionStyle } from '../../model/caption-lines.ts';
import { captionStyleOperations } from '../../model/caption-presets.ts';
import type { Json, LineKind } from '../../render/text-style.ts';
import { useCaptionPreferences } from '../../state/caption-preferences-store.ts';
import { useEditor } from '../../state/editor-store.ts';

/**
 * One edit to a caption style (shared by the properties page and by dragging captions on the stage): while dragging, the value is overlaid on the preview as a draft of the document (the store's document draft, see DraftDocuments in video-editor); on release, it is written as a new version of the document. When a caption has no caption style document yet, there is no draft to overlay: on release, a new document is created, and every caption in the sequence that has no style yet and can be edited uses it.
 */

/** While dragging: overlays this root style on the preview. */
export function previewCaptionStyle(record: DocumentRecord | undefined, body: unknown, style: Json): void {
  if (!record) return;
  useEditor.getState().setDocumentDraft({ documentId: record.id, baseRevision: record.currentRevision, body: withCaptionStyle(body, style) });
}

/**
 * On release: writes (or creates) the style document; if that fails, the draft is discarded. On success, this change is recorded in the new-caption options (`before` is the root style before the change; see `rememberCaptionPreferences` for `singleLine`).
 */
export function saveCaptionStyle(
  apply: (operations: EditOperation[], label?: Localized) => Promise<TransactionReceipt | null>,
  edit: { sequence: Sequence; record: DocumentRecord | undefined; body: unknown; before: Json | null; style: Json; label: Localized },
  singleLine?: LineKind,
): void {
  const { sequence, record, body, before, style, label } = edit;
  const nextBody = withCaptionStyle(body, style);
  let operations: EditOperation[];
  if (record) {
    useEditor.getState().setDocumentDraft({ documentId: record.id, baseRevision: record.currentRevision, body: nextBody });
    operations = [{ type: 'putDocument', documentId: record.id, kind: record.kind, body: nextBody }];
  } else {
    operations = captionStyleOperations(sequence, undefined, nextBody);
  }
  void apply(operations, label).then((receipt) => {
    if (!receipt) useEditor.getState().clearDrafts();
    else if (before) useCaptionPreferences.getState().remember(before, style, singleLine);
  });
}
