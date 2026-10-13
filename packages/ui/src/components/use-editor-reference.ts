import { useCallback, useEffect, useMemo, useState, useSyncExternalStore } from 'react';
import type { EditorContext, Id } from '@cuccut/protocol';
import { sequenceChapters, visibleChapters } from '../model/chapters.ts';
import type { VideoMentions } from '../model/composer-completions.ts';
import { readSpeechWords } from '../model/speech-cues.ts';
import { useRuntime } from '../runtime/context.tsx';
import { captureEditorContext, useContextTag, type ContextScope } from '../state/agent-context.ts';
import { useVideo } from '../state/video-store.ts';
import type { ComposerProps } from './composer.tsx';
import { mediaCandidates } from './editor/transcribe-run.ts';
import { S } from './shell-copy.ts';

/**
 * The video reference chip above the input box and the context sent with a message (product design §3.2.3, §3.2.4).
 * Removing the chip only affects the next message. Before sending, wait until the edits already sent from the editor have results, then take the version.
 */
export function useEditorReference(scope: ContextScope): {
  reference: ComposerProps['reference'];
  /** Called when sending: returns the context at this moment if it should be attached. */
  capture(): Promise<EditorContext | undefined>;
  /** Called after a successful send: restores the chip. */
  reset(): void;
} {
  const runtime = useRuntime();
  const tag = useContextTag(scope);
  const [excluded, setExcluded] = useState<Id | null>(null);
  const included = tag !== null && excluded !== tag.videoId;
  return {
    reference: included
      ? {
          label: S.editorReference.label(tag.videoName, tag.selected),
          description: S.editorReference.description,
          onRemove: () => setExcluded(tag.videoId),
        }
      : null,
    capture: async () => {
      if (!included) return undefined;
      await runtime.videos.settled();
      return captureEditorContext(scope) ?? undefined;
    },
    reset: () => setExcluded(null),
  };
}

/**
 * The data for the “this video” group in the @ completion (design mockup model-agent.js `mentionItems`): the main sequence chapters of the open video the session can attach (the same check as the reference chip), and the speakers who appear in the transcripts on the timeline (names de-duplicated). The transcript text is fetched through the video's document cache, which the transcript panel shares.
 * null when nothing is open or in scope.
 */
export function useVideoMentions(scope: ContextScope): VideoMentions | null {
  const documents = useRuntime().videos.documents;
  const tag = useContextTag(scope);
  const snapshot = useVideo((s) => (tag && s.video?.videoId === tag.videoId ? (s.video.state?.video ?? null) : null));
  const sequence = snapshot ? snapshot.sequences[snapshot.rootSequenceId] : undefined;
  const speech = useMemo(
    () => (snapshot && sequence ? mediaCandidates(sequence, snapshot.assets, snapshot.documents).flatMap((c) => (c.speech ? [c.speech] : [])) : []),
    [snapshot, sequence],
  );
  const key = speech.map((record) => `${record.id}@${record.currentRevision}`).join(',');
  useEffect(() => {
    // Fetched by “document@version”: it needs fetching again only when `key` changes.
    for (const record of speech) documents.load(record.id, record.currentRevision);
  }, [documents, key]);
  const subscribe = useCallback((listener: () => void) => documents.subscribe(listener), [documents]);
  const ready = useSyncExternalStore(subscribe, () => speech.map((r) => (documents.peek(r.id, r.currentRevision) === undefined ? 0 : 1)).join(''));
  return useMemo(() => {
    if (!sequence) return null;
    const speakers = new Map<string, { id: string; name: string }>();
    for (const record of speech) {
      const read = readSpeechWords(documents.peek(record.id, record.currentRevision));
      if (!read) continue;
      for (const word of read.words) {
        if (word.speaker === undefined) continue;
        const name = read.speakers.get(word.speaker) ?? word.speaker;
        if (!speakers.has(name)) speakers.set(name, { id: `${record.id}:${word.speaker}`, name });
      }
    }
    return { chapters: visibleChapters(sequenceChapters(sequence)), speakers: [...speakers.values()] };
    // `ready`: recomputed only once the body has been fetched.
  }, [sequence, speech, documents, ready]);
}
