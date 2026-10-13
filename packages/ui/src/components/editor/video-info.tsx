import { useCallback, useEffect, useMemo, useSyncExternalStore } from 'react';
import type { AssetRecord, DocumentRecord, Id, Sequence } from '@cuccut/protocol';
import { EditLabel } from '@cuccut/protocol/messages/ui';
import { langName } from '../../model/tools-models.ts';
import { contentCounts, editorExtras, snapshotFacts, translationTargets } from '../../model/video-info.ts';
import { useRuntime } from '../../runtime/context.tsx';
import { canEdit, type OpenVideo } from '../../state/video-store.ts';
import { VideoInfoDialog } from '../video-info-dialog.tsx';
import { useEditorActions } from './editor-context.tsx';
import { mediaCandidates } from './transcribe-run.ts';
import { VIDEO_BAR_COPY as VB } from './video-bar-copy.ts';

const NO_ASSETS: Record<Id, AssetRecord> = {};
const NO_DOCUMENTS: Record<Id, DocumentRecord> = {};

/**
 * Video details opened by ⓘ in the editor top bar: all the facts come from the opened video's snapshot and the transcript body. The body shares a cache with the transcript panel; if the panel has not fetched it, it is fetched the same way.
 * Renaming goes through `renameVideo`, the same edit as renaming by clicking the title. When the video cannot currently be edited, the name is greyed out.
 */
export function EditorVideoInfo({ video, sequence, onClose }: { video: OpenVideo; sequence: Sequence | null; onClose(): void }) {
  const { apply } = useEditorActions();
  const snapshot = video.state?.video ?? null;
  const assets = snapshot?.assets ?? NO_ASSETS;
  const documents = snapshot?.documents ?? NO_DOCUMENTS;
  const candidates = useMemo(() => (sequence ? mediaCandidates(sequence, assets, documents) : []), [sequence, assets, documents]);
  const speeches = useMemo(() => candidates.flatMap((c) => (c.speech ? [{ assetId: c.asset.id, record: c.speech }] : [])), [candidates]);
  const bodies = useDocumentBodies(speeches.map((s) => s.record));

  const title = snapshot?.name ?? video.ref?.name ?? VB.untitled;
  const facts = snapshotFacts({
    title,
    location: video.ref?.path ?? null,
    sequence,
    candidates,
    speechBody: bodies[0],
    languageName: langName,
  });
  const extras = sequence
    ? editorExtras(
        contentCounts(
          sequence,
          speeches.map((s, i) => ({ assetId: s.assetId, body: bodies[i] })),
        ),
        translationTargets(documents, langName),
      )
    : [];

  return (
    <VideoInfoDialog
      facts={facts}
      extras={extras}
      onRename={canEdit(video) ? async (name) => (await apply([{ type: 'renameVideo', name }], EditLabel.renameVideo())) !== null : undefined}
      onClose={onClose}
    />
  );
}

/** Bodies of several documents (same as `useDocumentBody`, subscribed as a group): undefined until fetched, redrawn once fetched. */
function useDocumentBodies(records: readonly DocumentRecord[]): unknown[] {
  const documents = useRuntime().videos.documents;
  const keys = records.map((r) => `${r.id}@${r.currentRevision}`).join('|');
  useEffect(() => {
    for (const record of records) documents.load(record.id, record.currentRevision);
    // keys already summarizes what records needs to fetch.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [documents, keys]);
  const subscribe = useCallback((listener: () => void) => documents.subscribe(listener), [documents]);
  // The snapshot takes a string signature, so that every render does not produce a new array. The actual body is peeked at render time.
  useSyncExternalStore(subscribe, () => records.map((r) => (documents.peek(r.id, r.currentRevision) === undefined ? 0 : 1)).join(''));
  return records.map((r) => documents.peek(r.id, r.currentRevision));
}
