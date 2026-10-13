import { useCallback, useEffect, useMemo, useSyncExternalStore } from 'react';
import type { DocumentRecord } from '@cuccut/protocol';
import { useRuntime } from '../../runtime/context.tsx';

/** Body of the document's current version (via the video's document cache, shared with preview); undefined before it is fetched. */
export function useDocumentBody(record: DocumentRecord | undefined): unknown {
  const documents = useRuntime().videos.documents;
  const id = record?.id;
  const revision = record?.currentRevision;
  useEffect(() => {
    if (id && revision) documents.load(id, revision);
  }, [documents, id, revision]);
  const subscribe = useCallback((listener: () => void) => documents.subscribe(listener), [documents]);
  return useSyncExternalStore(subscribe, () => (id && revision ? documents.peek(id, revision) : undefined));
}

/** Bodies of several documents' current versions (same as `useDocumentBody`), one-to-one with `records`; undefined for those not yet fetched. */
export function useDocumentBodies(records: readonly DocumentRecord[]): unknown[] {
  const documents = useRuntime().videos.documents;
  const key = records.map((r) => `${r.id}@${r.currentRevision}`).join('|');
  useEffect(() => {
    for (const r of records) documents.load(r.id, r.currentRevision);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- `key` already summarizes the part of records that is needed
  }, [documents, key]);
  const subscribe = useCallback((listener: () => void) => documents.subscribe(listener), [documents]);
  // The snapshot only records “which ones have arrived”. A body does not change per version, so its reference is stable once fetched.
  const loaded = useSyncExternalStore(subscribe, () => records.map((r) => (documents.peek(r.id, r.currentRevision) === undefined ? 0 : 1)).join(''));
  // eslint-disable-next-line react-hooks/exhaustive-deps -- same as above
  return useMemo(() => records.map((r) => documents.peek(r.id, r.currentRevision)), [documents, key, loaded]);
}
