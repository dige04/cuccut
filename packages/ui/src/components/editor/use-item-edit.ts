import type { EditOperation, Localized, Sequence, SequenceItem } from '@cuccut/protocol';
import type { ItemPatch } from '../../model/item-draft.ts';
import { useEditor } from '../../state/editor-store.ts';
import { useEditorActions } from './editor-context.tsx';

export interface ItemEdit {
  /** While dragging: applied only to the preview and property page, not committed. */
  live(patch: ItemPatch): void;
  /** Commit an edit. On failure, discard the draft and revert to the original value (the editor shows the error). */
  commit(operations: EditOperation[], label?: Localized): void;
}

/** The property page edits a clip: a value being dragged goes into the draft and is committed on release. The draft records the sequence version; after a successful commit, it is no longer applied once the new version arrives. */
export function useItemEdit(sequence: Sequence, item: SequenceItem): ItemEdit {
  const { apply } = useEditorActions();
  return {
    live: (patch) => useEditor.getState().setDraft({ itemId: item.id, revision: sequence.revision, patch }),
    commit: (operations, label) =>
      void apply(operations, label).then((receipt) => {
        if (!receipt) useEditor.getState().clearDrafts();
      }),
  };
}
