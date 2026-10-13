import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useEditor } from '../../state/editor-store.ts';
import { DraftDocuments, draftedBody, dropStaleDraft } from './draft-documents.ts';

// Node has no usable localStorage: give persistence an in-memory version, loaded before the store module.
vi.hoisted(() => {
  const data = new Map<string, string>();
  Object.defineProperty(globalThis, 'localStorage', {
    configurable: true,
    value: {
      getItem: (key: string) => data.get(key) ?? null,
      setItem: (key: string, value: string) => void data.set(key, value),
      removeItem: (key: string) => void data.delete(key),
    },
  });
});

const draft = { documentId: 'doc_style', baseRevision: 'r1', body: { y: 40 } };

describe('document drafts', () => {
  beforeEach(() => useEditor.setState({ documentDraft: null }));

  it('the draft\'s base version fetches the draft; other documents are unaffected', () => {
    expect(draftedBody(draft, 'doc_style', 'r1', { y: 86 })).toEqual({ y: 40 });
    expect(draftedBody(draft, 'doc_other', 'r1', { y: 86 })).toEqual({ y: 86 });
    expect(draftedBody(null, 'doc_style', 'r1', { y: 86 })).toEqual({ y: 86 });
  });

  it('after a commit, the draft is used until the new version is fetched; once fetched, the new body is used', () => {
    expect(draftedBody(draft, 'doc_style', 'r2', undefined)).toEqual({ y: 40 });
    expect(draftedBody(draft, 'doc_style', 'r2', { y: 41 })).toEqual({ y: 41 });
  });

  it('the draft is dropped when the new version\'s body arrives; a draft for the same version is kept', () => {
    useEditor.setState({ documentDraft: draft });
    dropStaleDraft('doc_style', 'r1', { y: 86 });
    expect(useEditor.getState().documentDraft).toBe(draft);
    dropStaleDraft('doc_style', 'r2', undefined);
    expect(useEditor.getState().documentDraft).toBe(draft);
    dropStaleDraft('doc_style', 'r2', { y: 41 });
    expect(useEditor.getState().documentDraft).toBeNull();
  });

  it('preview source overlaid with the draft; a changed draft notifies a redraw', () => {
    const bodies = new Map([['doc_style@r1', { y: 86 }]]);
    const inner = { peek: (id: string, rev: string) => bodies.get(`${id}@${rev}`), load: vi.fn(), subscribe: () => () => {} };
    const documents = new DraftDocuments(inner);
    const listener = vi.fn();
    const off = documents.subscribe(listener);
    expect(documents.peek('doc_style', 'r1')).toEqual({ y: 86 });
    useEditor.setState({ documentDraft: draft });
    expect(listener).toHaveBeenCalledTimes(1);
    expect(documents.peek('doc_style', 'r1')).toEqual({ y: 40 });
    off();
    useEditor.setState({ documentDraft: null });
    expect(listener).toHaveBeenCalledTimes(1);
  });

  it('after a commit, the preview fetches the new version itself and drops the draft once fetched: undoing back to the old version draws the old body and no longer shows the draft', async () => {
    const bodies = new Map<string, unknown>([['doc_style@r1', { y: 86 }]]);
    const inner = { peek: (id: string, rev: string) => bodies.get(`${id}@${rev}`), load: vi.fn(), subscribe: () => () => {} };
    const documents = new DraftDocuments(inner);
    useEditor.setState({ documentDraft: draft });
    // Committed, the document has reached r2, but the body is not fetched yet: draw the draft first and fetch r2 (the preview gets a value rather than undefined, so it would not fetch on its own).
    expect(documents.peek('doc_style', 'r2')).toEqual({ y: 40 });
    expect(inner.load).toHaveBeenCalledWith('doc_style', 'r2');
    bodies.set('doc_style@r2', { y: 40 });
    expect(documents.peek('doc_style', 'r2')).toEqual({ y: 40 });
    await Promise.resolve();
    expect(useEditor.getState().documentDraft).toBeNull();
    // Undo: the document goes back to r1.
    expect(documents.peek('doc_style', 'r1')).toEqual({ y: 86 });
    // While dragging (still on the version the draft is based on), do not fetch.
    inner.load.mockClear();
    useEditor.setState({ documentDraft: draft });
    documents.peek('doc_style', 'r1');
    expect(inner.load).not.toHaveBeenCalled();
  });
});
