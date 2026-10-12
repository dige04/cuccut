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
 * 结果页与父视频「切出的短视频」一组对还没在编辑器里开着的子视频做的事：读它的派生来源、眼下的时长与开头那一句、改名、
 * 逐支导出（「全部导出…」）。都在后台打开视频、做完再关掉
 * （同 components/thread/change-undo.ts `undoInBackground`）；编辑器此刻占着那部视频时不替它关。
 *
 * 未验证：后台打开期间编辑器恰好开始打开同一部视频时，这里的关闭可能先落到 Runtime，编辑器会收到 `video.closed` 再自己重新打开，
 * 画面闪一下，不丢数据（同 change-undo.ts 的说明）。
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

/** 子视频卡上的「起止 · 时长」与「开头」：派生来源里的区间，它剪辑后眼下的时长（秒），开头那一句。 */
export interface ShortFacts {
  derivation: ShortsDerivation | null;
  seconds: number | null;
  /** 开头那一句：派生时给了 `hook` 就是它，否则是保留段的第一句；没有文稿或还没读到时 null。 */
  opening: string | null;
}

/**
 * 保留段的第一句：主素材（时间线上最早出现、有转写的那段）的转写投到序列上，第一个留下的词所在那一句（`openingSentence`）。
 * 要读转写正文：只在派生时没给 `hook` 时读。
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
 * 读一支子视频的派生来源与眼下的时长；`withOpening` 时另读开头那一句（没有 `hook` 时要读转写正文）。
 * 按 `key`（条目 id 加最近活动时间）缓存：子视频改过之后最近活动变了，再读一次。
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

/** 改一支子视频的名字（`renameVideo`）：编辑器开着它就走编辑器的命令队列，没开着就在后台打开、改、关。 */
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

/** 开着的那一支的开头那一句：按视频版本读一次。 */
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
 * 一支子视频的派生来源、眼下的时长与开头那一句：编辑器开着它时读编辑器里的快照，其余在后台读一次（`peekShort`）。
 * 结果页的卡片与父视频「切出的短视频」一组共用。
 */
export function useShortFacts(entry: SpaceEntry, withOpening = true): ShortFacts {
  const runtime = useRuntime();
  const videoId = entryVideoId(entry);
  const live = useVideo((s) => (s.video && s.video.videoId === videoId && s.video.status === 'ready' ? (s.video.state?.video ?? null) : null));
  const [peeked, setPeeked] = useState<ShortFacts | null>(null);
  const [opening, setOpening] = useState<{ revision: string; text: string | null } | null>(null);
  // `entry` 换了对象但 `key` 没变时不用再读：目标按 `key` 记下来。
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
    // 新版本的开头还在读时先用上一版的，免得每改一次闪一下。
    return { derivation, seconds: root ? durationSeconds(root) : null, opening: derivation?.hook ?? opening?.text ?? null };
  }, [live, opening]);
  return liveFacts ?? peeked ?? { derivation: null, seconds: entry.media?.durationSec ?? null, opening: null };
}

// ---- 全部导出（结果页「全部导出…」） ----

/** 逐支导出的结果：发起了几条导出任务、跳过了哪几支（名字与原因）；桌面端没选存放位置时 `cancelled`。 */
export interface ShortsExportOutcome {
  started: Id[];
  skipped: { name: string; reason: string }[];
  cancelled: boolean;
}

/**
 * 「全部导出…」：给每支子视频各发起一次成片导出（`exports.create`，缺省设置：MP4、画质标准、跟随画布、烧进字幕），
 * 各是一条导出任务，进度在任务列表里（开着的那一支另在视频栏的导出按钮上）。桌面端先选一次存放的文件夹（只有一支时选文件），
 * Web 交给 Runtime 的缺省位置。编辑器正在打开的那一支、后台打不开或预检被拒的那一支跳过，原因记进结果。
 * Runtime 冻结快照后才建任务，任务不再读打开着的视频，所以后台打开的那一支建好任务就关掉。
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
