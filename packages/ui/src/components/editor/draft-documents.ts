import type { Id, Revision } from '@cuccut/protocol';
import { useEditor, type DocumentDraft } from '../../state/editor-store.ts';
import type { PreviewDocuments } from './preview-engine.ts';

/**
 * Overlays the properties page's draft (the value being dragged for a caption style) onto the document body: the draft is used for the version it was based on. After a commit, when the document has a new version and its new body is not fetched yet, the draft is still used, so the style does not jump back to the old one and then to the new one. Once the new body arrives, it is used.
 */
export function draftedBody(draft: DocumentDraft | null, documentId: Id, revision: Revision, body: unknown): unknown {
  if (!draft || draft.documentId !== documentId) return body;
  return revision === draft.baseRevision || body === undefined ? draft.body : body;
}

/** The draft has been replaced by the new version's body: discard it, so that when undo returns to the old version, it does not reappear. */
export function dropStaleDraft(documentId: Id, revision: Revision, body: unknown): void {
  const draft = useEditor.getState().documentDraft;
  if (draft?.documentId === documentId && draft.baseRevision !== revision && body !== undefined)
    useEditor.setState({ documentDraft: null });
}

/** The document source for the preview: the body comes from the cache with the draft overlaid; when the draft changes, a redraw is also signaled. */
export class DraftDocuments implements PreviewDocuments {
  readonly #inner: PreviewDocuments;

  constructor(inner: PreviewDocuments) {
    this.#inner = inner;
  }

  peek(documentId: Id, revision: Revision): unknown {
    const body = this.#inner.peek(documentId, revision);
    const draft = useEditor.getState().documentDraft;
    // The document has moved past the version the draft was based on (it was committed): once the new body arrives, drop the draft; until then, fetch it here, since the draft is what is returned in the meantime. The preview does not fetch on its own when it gets undefined, so the draft would never be dropped, and after undoing back to the old version the picture would stay stuck on the draft.
    if (draft?.documentId === documentId && draft.baseRevision !== revision) {
      if (body === undefined) this.#inner.load(documentId, revision);
      else queueMicrotask(() => dropStaleDraft(documentId, revision, body));
    }
    return draftedBody(draft, documentId, revision, body);
  }

  load(documentId: Id, revision: Revision): void {
    this.#inner.load(documentId, revision);
  }

  forgetPending(): void {
    this.#inner.forgetPending?.();
  }

  subscribe(listener: () => void): () => void {
    const offInner = this.#inner.subscribe(listener);
    const offDraft = useEditor.subscribe((state, previous) => {
      if (state.documentDraft !== previous.documentDraft) listener();
    });
    return () => {
      offInner();
      offDraft();
    };
  }
}
