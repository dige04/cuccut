import { useEffect, useMemo, useState } from 'react';
import { newId, type FileTarget, type Id, type SpaceEntry, type VideoSnapshot } from '@cuccut/protocol';
import { durationSeconds, rootSequence } from '../../model/editor.ts';
import { pickExportDestination } from '../../model/export-destination.ts';
import { explainExportError } from '../../model/export-rejection.ts';
import { DEFAULT_LOUDNESS_FORM, DEFAULT_VIDEO_FORM, safeFileStem, videoSettings } from '../../model/export-settings.ts';
import { openingSentence } from '../../model/shorts-fold.ts';
import { entryVideoId, readDerivation, type ShortsDerivation } from '../../model/shorts-result.ts';
import { videoTargetOf } from '../../model/space.ts';
import { readSpeechWords } from '../../model/speech-cues.ts';
import { transcriptParagraphs, transcriptWords } from '../../model/transcript-cut.ts';
import { useRuntime } from '../../runtime/context.tsx';
import type { RuntimeSession } from '../../runtime/session.ts';
import { sameTarget } from '../../runtime/video-controller.ts';
import { useVideo } from '../../state/video-store.ts';
import { EXPORT_COPY } from '../export/export-copy.ts';
import { mediaCandidates } from './transcribe-run.ts';

/**
 * Operations on child videos that are not open in the editor, for the result page and the “切出的短视频”(shorts cut from this video) group in the parent video: reading each one's derived source, its current duration and opening sentence, renaming, and
 * exporting them one by one (“全部导出…”(export all…)). Each one opens the video in the background and closes it again when done
 * (same as `undoInBackground` in components/thread/change-undo.ts). If the editor is holding that video at the moment, it is not closed on its behalf.
 *
 * Unverified: if, while the background open is in progress, the editor happens to start opening the same video, this close may reach the Runtime first. The editor will then receive `video.closed` and reopen the video itself,
 * causing a brief flicker of the picture but no data loss (same note as in change-undo.ts).
 */

function editorHolds(target: FileTarget, videoId: Id): boolean {
  const video = useVideo.getState().video;
  return video !== null && (video.videoId === videoId || sameTarget(video.target, target));
}

async function withVideo<T>(runtime: RuntimeSession, target: FileTarget, run: (videoId: Id, opened: Awaited<ReturnType<typeof open>>) => Promise<T>) {
  const opened = await open(runtime, target);
  try {
    return await run(opened.ref.videoId, opened);
  } finally {
    if (!editorHolds(target, opened.ref.videoId)) await runtime.client.request('videos.close', { videoId: opened.ref.videoId }).catch(() => {});
  }
}

const open = (runtime: RuntimeSession, target: FileTarget) => runtime.client.request('videos.open', target);

/** On the child video card, the “起止 · 时长”(range · duration) and “开头”(opening): the range in the derived source, its current duration after editing (seconds), and the opening sentence. */
export interface ShortFacts {
  derivation: ShortsDerivation | null;
  seconds: number | null;
  /** The opening sentence: if `hook` was given at derivation, it is that; otherwise it is the first sentence of the kept segments. Null when there is no script or it has not been read yet. */
  opening: string | null;
}

/**
 * The first sentence of the kept segments: the transcript of the main footage (the segment that appears earliest on the timeline and has a transcript) is projected onto the sequence, and this is the sentence containing the first kept word (`openingSentence`).
 * The transcript text is read only when `hook` was not given at derivation.
 */
async function readOpening(runtime: RuntimeSession, videoId: Id, video: VideoSnapshot): Promise<string | null> {
  const derivation = readDerivation(video.documents);
  if (derivation?.hook) return derivation.hook;
  const sequence = rootSequence(video);
  if (!sequence) return null;
  const source = mediaCandidates(sequence, video.assets, video.documents).find((c) => c.speech);
  if (!source?.speech) return null;
  const { body } = await runtime.client.request('documents.read', { videoId, documentId: source.speech.id });
  const read = readSpeechWords(body);
  if (!read) return null;
  const words = transcriptWords(sequence, source.asset.id, read.words);
  return openingSentence(words, transcriptParagraphs(words));
}

async function factsOf(runtime: RuntimeSession, videoId: Id, video: VideoSnapshot, withOpening: boolean): Promise<ShortFacts> {
  const root = rootSequence(video);
  const opening = withOpening ? await readOpening(runtime, videoId, video).catch(() => null) : (readDerivation(video.documents)?.hook ?? null);
  return { derivation: readDerivation(video.documents), seconds: root ? durationSeconds(root) : null, opening };
}

const facts = new Map<string, Promise<ShortFacts>>();

/**
 * Reads a child video's derived source and current duration. With `withOpening`, it also reads the opening sentence (which requires reading the transcript text when there is no `hook`).
 * Cached by `key` (the item id plus last activity time): after the child video is edited, the last activity changes, so it is read again.
 */
export function peekShort(runtime: RuntimeSession, target: FileTarget, key: string, withOpening = true): Promise<ShortFacts> {
  const slot = `${key}|${withOpening ? 'opening' : 'plain'}`;
  const cached = facts.get(slot) ?? (withOpening ? undefined : facts.get(`${key}|opening`));
  if (cached) return cached;
  const pending = withVideo(runtime, target, (videoId, opened) => factsOf(runtime, videoId, opened.snapshot.video, withOpening)).catch((error: unknown) => {
    facts.delete(slot);
    throw error;
  });
  facts.set(slot, pending);
  return pending;
}

/** Renames a child video (`renameVideo`). If the editor has it open, the rename goes through the editor's command queue; otherwise the video is opened in the background, renamed, and closed. */
export async function renameShort(runtime: RuntimeSession, target: FileTarget, videoId: Id, name: string): Promise<void> {
  const operations = [{ type: 'renameVideo' as const, name }];
  if (useVideo.getState().video?.videoId === videoId) {
    await runtime.videos.apply(operations);
    return;
  }
  await withVideo(runtime, target, async (id, opened) => {
    await runtime.client.request('edits.apply', {
      videoId: id,
      commandId: newId('cmd'),
      expectedRevision: opened.snapshot.video.revision,
      operations,
    });
  });
}

/** The opening sentence of the clip that is open: read once per video version. */
const openings = new Map<string, Promise<string | null>>();
function liveOpening(runtime: RuntimeSession, videoId: Id, video: VideoSnapshot): Promise<string | null> {
  const key = `${videoId}@${video.revision}`;
  let pending = openings.get(key);
  if (!pending) {
    pending = readOpening(runtime, videoId, video).catch(() => {
      openings.delete(key);
      return null;
    });
    openings.set(key, pending);
  }
  return pending;
}

/**
 * A child video's derived source, current duration and opening sentence: when the editor has it open, the editor's snapshot is read; otherwise it is read once in the background (`peekShort`).
 * Shared by the result page cards and the “切出的短视频”(shorts cut from this video) group in the parent video.
 */
export function useShortFacts(entry: SpaceEntry, withOpening = true): ShortFacts {
  const runtime = useRuntime();
  const videoId = entryVideoId(entry);
  const live = useVideo((s) => (s.video && s.video.videoId === videoId && s.video.status === 'ready' ? (s.video.state?.video ?? null) : null));
  const [peeked, setPeeked] = useState<ShortFacts | null>(null);
  const [opening, setOpening] = useState<{ revision: string; text: string | null } | null>(null);
  // When `entry` is a new object but `key` is unchanged, there is no need to read again: the target is recorded by `key`.
  const key = `${entry.id}@${entry.lastActivityAt}`;
  const target = useMemo(() => videoTargetOf(entry), [key]); // eslint-disable-line react-hooks/exhaustive-deps
  const isLive = !!live;
  useEffect(() => {
    if (isLive) return;
    let alive = true;
    peekShort(runtime, target, key, withOpening)
      .then((facts) => alive && setPeeked(facts))
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, [runtime, target, key, isLive, withOpening]);
  useEffect(() => {
    if (!live || !videoId || !withOpening) return;
    let alive = true;
    void liveOpening(runtime, videoId, live).then((text) => alive && setOpening({ revision: live.revision, text }));
    return () => {
      alive = false;
    };
  }, [runtime, videoId, live, withOpening]);
  const liveFacts = useMemo(() => {
    if (!live) return null;
    const root = rootSequence(live);
    const derivation = readDerivation(live.documents);
    // While the opening of the new version is still being read, use the previous version's, so it does not flash on every edit.
    return { derivation, seconds: root ? durationSeconds(root) : null, opening: derivation?.hook ?? opening?.text ?? null };
  }, [live, opening]);
  return liveFacts ?? peeked ?? { derivation: null, seconds: entry.media?.durationSec ?? null, opening: null };
}

// ---- Export all (“全部导出…” on the result page) ----

/** Result of exporting one by one: how many export tasks were started, and which clips were skipped (name and reason). `cancelled` is set when no save location was chosen on desktop. */
export interface ShortsExportOutcome {
  started: Id[];
  skipped: { name: string; reason: string }[];
  cancelled: boolean;
}

/**
 * “全部导出…”(export all…): starts one final export for each child video (`exports.create`, default settings: MP4, standard quality, follow canvas, burn in captions).
 * Each is its own export task, with progress shown in the task list (the clip that is open is also shown on the export button in the video bar). On desktop, a save folder is chosen first (a file is chosen instead when there is only one clip).
 * On the web, the Runtime's default location is used. A clip the editor is holding, and any clip that cannot be opened in the background or is rejected by the pre-check, is skipped, and the reason is recorded in the result.
 * The Runtime freezes a snapshot before creating a task, and the task no longer reads the open video, so a clip opened in the background is closed as soon as its task has been created.
 */
export async function exportShorts(runtime: RuntimeSession, entries: readonly SpaceEntry[], labels: { opening: string }): Promise<ShortsExportOutcome> {
  const outcome: ShortsExportOutcome = { started: [], skipped: [], cancelled: false };
  if (!entries.length) return outcome;
  const names = entries.map((e) => `${safeFileStem(e.name)}.mp4`);
  let picked: Awaited<ReturnType<typeof pickExportDestination>>;
  try {
    picked = await pickExportDestination(runtime.host, names, null, EXPORT_COPY);
  } catch (error) {
    outcome.skipped = entries.map((e) => ({ name: e.name, reason: error instanceof Error ? error.message : String(error) }));
    return outcome;
  }
  if (!picked) return { ...outcome, cancelled: true };
  const destination = picked;
  for (const entry of entries) {
    const videoId = entryVideoId(entry);
    if (!videoId) continue;
    const target = videoTargetOf(entry);
    const editor = useVideo.getState().video;
    const held = editor !== null && (editor.videoId === videoId || sameTarget(editor.target, target));
    if (held && (editor.status !== 'ready' || !editor.state || !editor.videoId)) {
      outcome.skipped.push({ name: entry.name, reason: labels.opening });
      continue;
    }
    const create = async (id: Id, video: VideoSnapshot) => {
      const sequence = rootSequence(video);
      if (!sequence) throw new Error(labels.opening);
      const settings = videoSettings(DEFAULT_VIDEO_FORM, sequence.canvas, {}, DEFAULT_LOUDNESS_FORM);
      try {
        return await runtime.createExport({ videoId: id, settings, ...(Object.keys(destination).length ? { destination } : {}) });
      } catch (error) {
        throw new Error(explainExportError(error, { kind: 'video', stage: 'rejected', documents: video.documents }).title);
      }
    };
    try {
      const jobId = held ? await create(editor.videoId!, editor.state!.video) : await withVideo(runtime, target, (id, opened) => create(id, opened.snapshot.video));
      outcome.started.push(jobId);
    } catch (error) {
      outcome.skipped.push({ name: entry.name, reason: error instanceof Error ? error.message : String(error) });
    }
  }
  return outcome;
}
