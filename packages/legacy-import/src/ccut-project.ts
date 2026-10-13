// i18n-ignore-file: Historical import report vocabulary is retained for compatibility with archived reports.
// cuccut-app `.ccut` project directory -> video plan.
//
// The old format has three kinds of project, with different files on disk:
// - caption / translation projects: `project.json` (main media) + `transcript.json` (words, speakers, translations) + `studio/data.json` (projection of caption lines and sentences);
// - timeline projects: additionally `timeline.json` (sources, clips, tracks/elements; times are decimal seconds, geometry is canvas percentages);
// - code projects: `main.ccut.tsx` + `data.json` + `assets/`; `project.json.media` points to the rendered mp4 (when not recorded, it is looked up in the project, see `discoverFilm`).
// Where each field goes: docs/design/timeline/element-model-mapping.md section 5.

import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import path from 'node:path';

import { audioStart, decimal, decimalText, frameAt, frameStart, mediaTime, micros, rateOf, reduce, snapFps } from './exact-time.ts';
import type { Rate } from './exact-time.ts';
import { EASE_NAMES, SPEECH_REF, clampTo, count, dirNameOf, lanes, newReport, uniqueName } from './video-plan.ts';
import type {
  AssetInfo,
  AssetPlan,
  CutSetPlan,
  DocumentPlan,
  DuckingPlan,
  ItemPlan,
  Json,
  KeyframePlan,
  MediaHint,
  ProjectPlan,
  TrackPlan,
  TransitionPlan,
  VideoContent,
} from './video-plan.ts';

type Obj = { [key: string]: any };

function readJson(file: string): Obj | null {
  if (!existsSync(file)) return null;
  return JSON.parse(readFileSync(file, 'utf8')) as Obj;
}

/** Fields of `place` (video format spec §3.5, same as v2). */
const PLACE_KEYS = ['x', 'y', 'w', 'scale', 'scaleY', 'rot', 'opacity', 'radius', 'cornerRadii', 'flipX', 'flipY'];
/** Appearance fields shared by media items. */
const MEDIA_KEYS = ['mode', 'fit', 'bg', 'mask', 'fx'];
/** Properties with keyframe bindings on the sequence; volume keyframes are the item's envelope. */
const KEYFRAME_PROPS = ['x', 'y', 'scale', 'scaleY', 'rot', 'opacity', 'radius'];
const TRANSITION_KINDS = ['dissolve', 'wipe', 'slide', 'zoom', 'iris'];
/** v2 word anchor: `~<source>:<word>`, optionally `:start` / `:end` (each may carry `+n` / `-n`), or `+n` without an endpoint. The default endpoint is the word start. */
const ANCHOR = /^~([A-Za-z0-9_.-]+):([A-Za-z0-9_.-]+?)(?::(start|end)([+-](?:\d+(?:\.\d+)?|\.\d+))?|\+(\d+(?:\.\d+)?|\.\d+))?$/;

const TRACK_NAMES: Record<string, string> = { 'video-track': '视频', overlay: '叠加', text: '文字', broll: 'B-roll', wm: '水印' };

const SIDECARS: [string, string][] = [
  ['.ccut/history', '旧项目的撤销历史（journal）'],
  ['ai', 'AI 流水线的中间结果（简报、润色、对齐缓存）'],
  ['checks', '检查结果'],
  ['tasks', '任务记录'],
  ['logs', '模型调用日志'],
  ['cache', '波形与缩略图缓存'],
  ['studio/edits.json', '编辑器的待应用修改'],
  ['reframe', '重构图的中间文件（已登记为素材的除外）'],
];

/** Possible extensions of the film rendered by a code project (the same ones v2 accepts when adopting a film). */
const FILM_EXTENSIONS = ['mp4', 'mov', 'mkv', 'webm', 'm4v', 'avi', 'ts'];

/**
 * When a code project did not record its render (or the recorded file is gone), look in the project for the film it rendered: video files at the project root and under `out/`
 * not starting with `.`. If there is exactly one, that is it; if there are several, take the one whose file name (without extension) equals the composition ID;
 * if that does not give exactly one, accept none (better to treat it as unrendered than to use a draft or another version as the proxy).
 */
export function discoverFilm(dir: string, compositionId?: string): string | null {
  const found: string[] = [];
  for (const sub of ['.', 'out']) {
    const full = path.join(dir, sub);
    if (!existsSync(full) || !statSync(full).isDirectory()) continue;
    for (const entry of readdirSync(full, { withFileTypes: true })) {
      if (!entry.isFile() || entry.name.startsWith('.')) continue;
      if (FILM_EXTENSIONS.includes(path.extname(entry.name).slice(1).toLowerCase())) found.push(path.join(full, entry.name));
    }
  }
  if (found.length === 1) return found[0]!;
  if (!compositionId) return null;
  const named = found.filter((file) => path.basename(file, path.extname(file)) === compositionId);
  return named.length === 1 ? named[0]! : null;
}

/** When the old project did not record a frame rate or size, ask the file directly. */
function probeVideo(file: string): { fps?: number; width?: number; height?: number; duration?: number } {
  if (!existsSync(file)) return {};
  try {
    const args = [
      '-v',
      'error',
      '-select_streams',
      'v:0',
      '-show_entries',
      'stream=avg_frame_rate,width,height:format=duration',
      '-of',
      'json',
      file,
    ];
    const probed = JSON.parse(execFileSync(process.env.CUCCUT_FFPROBE ?? 'ffprobe', args, { encoding: 'utf8' }));
    const stream = probed.streams?.[0];
    const [num, den] = String(stream?.avg_frame_rate ?? '')
      .split('/')
      .map(Number);
    const duration = Number(probed.format?.duration);
    return {
      fps: num && den ? num / den : undefined,
      width: stream?.width,
      height: stream?.height,
      duration: Number.isFinite(duration) && duration > 0 ? duration : undefined,
    };
  } catch {
    return {};
  }
}

/** Starting from the entry file, collect the files the code bundle actually uses by following relative imports. */
function importClosure(root: string, entries: string[]): string[] {
  const seen = new Set<string>();
  const queue = [...entries];
  const resolve = (from: string, spec: string): string | null => {
    const base = path.normalize(path.join(path.dirname(from), spec));
    for (const candidate of [
      base,
      `${base}.tsx`,
      `${base}.ts`,
      `${base}.json`,
      path.join(base, 'index.tsx'),
      path.join(base, 'index.ts'),
    ]) {
      const full = path.join(root, candidate);
      if (!candidate.startsWith('..') && existsSync(full) && statSync(full).isFile()) return candidate;
    }
    return null;
  };
  while (queue.length > 0) {
    const file = queue.pop() as string;
    if (seen.has(file) || !existsSync(path.join(root, file))) continue;
    seen.add(file);
    if (!/\.(tsx?|jsx?|mjs)$/.test(file)) continue;
    const text = readFileSync(path.join(root, file), 'utf8');
    for (const match of text.matchAll(/(?:from|import|require\()\s*["'](\.{1,2}\/[^"']+)["']/g)) {
      const found = resolve(file, match[1]!);
      if (found) queue.push(found);
    }
  }
  return [...seen].sort();
}

function mediaHint(kind: string | undefined, source: Obj): MediaHint {
  const known = kind === 'video' || kind === 'audio' || kind === 'image' || kind === 'lottie' ? kind : 'other';
  return {
    kind: known,
    width: source.naturalW ?? source.width,
    height: source.naturalH ?? source.height,
    durationUs: source.duration ? micros(source.duration) : undefined,
    hasAudio: source.hasAudio ?? known === 'audio',
  };
}

function canvasFromRatio(ratio: string): { width: number; height: number } | null {
  const match = /^(\d+(?:\.\d+)?):(\d+(?:\.\d+)?)$/.exec(ratio);
  if (!match) return null;
  const [a, b] = [Number(match[1]), Number(match[2])];
  const even = (n: number): number => Math.round(n / 2) * 2;
  return a >= b ? { width: 1920, height: even((1920 * b) / a) } : { width: 1080, height: even((1080 * b) / a) };
}

export function planBcutProject(dir: string, taken: Set<string>, overrides: Record<string, Obj> = {}): ProjectPlan | null {
  const loadJson = (file: string): Obj | null => overrides[path.relative(dir, file).split(path.sep).join("/")] ?? readJson(file);
  const loaded = loadJson(path.join(dir, 'project.json'));
  if (!loaded) return null;
  const project: Obj = loaded;
  const base = path.basename(dir).replace(/\.ccut$/, '');
  const timeline = loadJson(path.join(dir, 'timeline.json'));
  const transcript = loadJson(path.join(dir, 'transcript.json'));
  const studio = loadJson(path.join(dir, 'studio', 'data.json'));
  let media: Obj | null = project.media ?? null;
  if (typeof media?.path === 'string' && media.path.trim() && !path.isAbsolute(media.path))
    media = { ...media, path: path.join(dir, media.path) };
  const isCode = typeof project.entry === 'string' && existsSync(path.join(dir, project.entry));
  const compiled = isCode ? loadJson(path.join(dir, 'out', 'doc.json')) : null;
  // The code project did not record its render, or the recorded in-project file is gone: look in the project for the rendered film to use as the prerender proxy.
  let adoptedFilm: string | null = null;
  if (isCode) {
    const declared = typeof media?.path === 'string' && media.path.trim() ? (media.path as string) : null;
    if (!declared || (declared.startsWith(dir + path.sep) && !existsSync(declared))) {
      adoptedFilm = discoverFilm(dir, typeof compiled?.meta?.id === 'string' ? compiled.meta.id : undefined);
      if (adoptedFilm) media = { path: adoptedFilm, kind: 'video' };
    }
  }
  let probed = false;
  if (media?.path && (!media.fps || !media.width)) {
    const found = probeVideo(media.path);
    probed = found.fps != null || found.width != null;
    media = {
      ...media,
      fps: media.fps ?? found.fps,
      width: media.width ?? found.width,
      height: media.height ?? found.height,
      duration: media.duration ?? found.duration,
    };
  }
  const elementCount = ((timeline?.tracks ?? []) as Obj[]).reduce((n, track) => n + (track.elements?.length ?? 0), 0);
  const kind = isCode
    ? 'code'
    : elementCount > 0 || (timeline?.clips?.length ?? 0) > 0
      ? 'timeline'
      : transcript
        ? 'subtitle'
        : media
          ? 'media'
          : 'blank';
  // A code project's `media` is the film it rendered (in the project's out/), not a source asset.
  const mainIsRender = isCode && typeof media?.path === 'string' && media.path.startsWith(dir + path.sep);
  // Code compositions in the new format need a prerender proxy: compositions without a render are not imported, and their code bundle is not registered either.
  const hasStandIn = mainIsRender && existsSync(media?.path) && (media?.kind ?? 'video') === 'video';

  // Frame rate: the old format stores floats, snapped to an exact frame rate; without main media use the frame rate from the code project's compile result, otherwise 30.
  const snapped = snapFps(media?.fps) ?? snapFps(compiled?.meta?.fps);
  const fps: Rate = snapped?.rate ?? { num: 30, den: 1 };
  const originalName = String(project.title || base).trim() || base;
  const name = [...originalName].slice(0, 200).join('');
  const report = newReport(dir, `ccut ${project.formatVersion ?? '?'}`, kind, originalName, fps);
  if (name !== originalName) {
    count(report.clamped, 'video-name');
    report.warnings.push('旧项目标题超过 200 个字符：视频名称取前 200 个字符，完整原标题保留在导入记录的 name 中');
  }
  report.fps = {
    legacy: media?.fps ?? compiled?.meta?.fps ?? null,
    rate: fps,
    ...(snapped
      ? snapped.snapped
        ? probed && !project.media?.fps
          ? { note: '旧项目没有记帧率，取自文件' }
          : {}
        : { note: '不是常见帧率，按整数取' }
      : { note: '旧项目没有帧率，按 30 取' }),
  };

  // Canvas: the old format does not store the canvas size on disk; only a few projects store an aspect ratio.
  const rotated = media && (media.rotation === 90 || media.rotation === 270);
  let canvas =
    media?.width && media?.height ? { width: rotated ? media.height : media.width, height: rotated ? media.width : media.height } : null;
  let canvasNote: string | undefined;
  if (compiled?.meta?.width && compiled?.meta?.height) canvas = { width: compiled.meta.width, height: compiled.meta.height };
  if (project.canvas?.ratio) {
    const fromRatio = canvasFromRatio(String(project.canvas.ratio));
    if (fromRatio && (!canvas || Math.abs(canvas.width / canvas.height - fromRatio.width / fromRatio.height) > 0.01)) {
      canvas = fromRatio;
      canvasNote = `旧项目只存了比例 ${project.canvas.ratio}，尺寸是估的`;
      count(report.estimated, 'canvas-size');
    }
  }
  if (!canvas) {
    canvas = { width: 1920, height: 1080 };
    canvasNote = '旧项目没有画布信息，按 1920×1080 取';
    count(report.estimated, 'canvas-size');
  }
  const { width: W, height: H } = canvas;
  report.canvas = { width: W, height: H, ...(canvasNote ? { note: canvasNote } : {}) };

  // ── Assets: all linked at their original paths ─────────────────────────────────────────
  const assets: AssetPlan[] = [];
  const refOfPath = new Map<string, string>();
  const refOfSource = new Map<string, string>();
  const addAsset = (ref: string, plan: Omit<AssetPlan, 'ref'>): string => {
    const existing = refOfPath.get(plan.path);
    if (existing) return existing;
    refOfPath.set(plan.path, ref);
    assets.push({ ref, ...plan });
    return ref;
  };
  if (media?.path) {
    const sourceMeta = project.url || media.sourceUrl || media.sourceMetadata;
    const provenance = mainIsRender
      ? { origin: 'render', source: { of: project.entry } as Json }
      : sourceMeta
        ? { origin: 'download', source: { url: project.url ?? media.sourceUrl ?? null, metadata: media.sourceMetadata ?? null } as Json }
        : { origin: 'user-import' };
    refOfSource.set(
      'main',
      addAsset('main', {
        path: media.path,
        provenance,
        legacyHash: typeof media.hash === 'string' ? media.hash : undefined,
        hint: mediaHint(media.kind ?? (media.width ? 'video' : 'audio'), { ...media, hasAudio: media.hasAudio ?? true }),
      }),
    );
    if (media.hash === 'pending') report.warnings.push('旧项目的主媒体摘要还是 pending：导入时重新计算');
  } else if (kind !== 'code' && kind !== 'blank') {
    report.warnings.push('旧项目没有主媒体');
  }
  if (isCode && media?.path && !mainIsRender) report.warnings.push('代码项目的主媒体不在项目的 out/ 里：按源素材处理，没有当成预渲染替身');
  if (adoptedFilm) report.warnings.push(`代码项目没有记下渲染结果：用项目里找到的成片 ${path.relative(dir, adoptedFilm)} 当预渲染替身`);
  const sources = (timeline?.sources ?? {}) as Record<string, Obj>;
  for (const [id, source] of Object.entries(sources)) {
    if (id === 'main' || !source.path) continue;
    const full = path.isAbsolute(source.path) ? source.path : path.join(dir, source.path);
    const ref = addAsset(`source:${id}`, {
      path: full,
      legacyHash: source.hash,
      provenance: { origin: id.startsWith('dub') ? 'generated' : 'user-import', source: { legacySourceId: id } },
      hint: mediaHint(source.kind, source),
    });
    refOfSource.set(id, ref);
  }
  if (isCode && hasStandIn) {
    const include = importClosure(
      dir,
      [project.entry, project.data].filter((f): f is string => typeof f === 'string'),
    );
    for (const extra of ['assets', 'music.json']) if (existsSync(path.join(dir, extra)) && !include.includes(extra)) include.push(extra);
    assets.push({
      ref: 'bundle',
      path: dir,
      name,
      include,
      bundle: {
        runtime: { kind: 'cuccut.dsl', dataVersion: loadJson(path.join(dir, String(project.data ?? 'data.json')))?.ccutData ?? null },
        entry: project.entry,
        data: project.data ?? null,
        width: W,
        height: H,
        fps: compiled?.meta?.fps ?? fps.num / fps.den,
        ...(compiled?.meta?.id ? { compositionId: compiled.meta.id } : {}),
      },
      provenance: { origin: 'user-import', source: { legacy: 'ccut code project' } },
      hint: { kind: 'bundle' },
    });
  }
  report.assets.planned = assets.length;

  for (const [rel, what] of SIDECARS) if (existsSync(path.join(dir, rel))) report.notImported.push(`${rel}：${what}`);
  if (!isCode && existsSync(path.join(dir, 'music.json'))) report.notImported.push('music.json：音乐节拍分析');

  const plan: ProjectPlan = {
    key: base,
    name,
    dirName: uniqueName(dirNameOf(base), taken),
    fps,
    width: W,
    height: H,
    assets,
    report,
    build: (known) => build(known),
  };
  return plan;

  // ── After asset registration: documents, tracks, items ─────────────────────────────────
  function build(known: Map<string, AssetInfo>): VideoContent {
    const documents: DocumentPlan[] = [];
    const tracks: TrackPlan[] = [];
    const items: ItemPlan[] = [];
    const main = known.get('main');
    const bundle = known.get('bundle');
    const mainSourceIds: string[] = [];
    const assetRef = (info: AssetInfo): Json => ({ id: info.id, revision: info.revision });
    const linear = (sourceInUs: bigint, rate: Rate): Json => ({ kind: 'linear', sourceIn: mediaTime(sourceInUs), rate: { ...rate } });
    const drop = (label: string, note: string): void => {
      count(report.dropped, label);
      report.warnings.push(note);
    };
    let background: string | undefined;

    const snap = (startUs: bigint, endUs: bigint): { fromFrame: number; durationFrames: number; shiftUs: bigint } => {
      const fromFrame = Math.max(0, frameAt(startUs, fps));
      const endFrame = Math.max(fromFrame + 1, frameAt(endUs, fps));
      const shiftUs = frameStart(fromFrame, fps) - startUs;
      for (const delta of [shiftUs, frameStart(endFrame, fps) - endUs]) {
        report.time.maxSnapMs = Math.max(report.time.maxSnapMs, Math.abs(Number(delta)) / 1000);
      }
      return { fromFrame, durationFrames: endFrame - fromFrame, shiftUs };
    };

    /** The source range must not exceed the asset: a trailing excess of less than one frame is trimmed here. Returns 0 when it does not fit. */
    const fitFrames = (durationFrames: number, sourceInUs: bigint, rate: Rate, durationUs: bigint | undefined): number => {
      if (durationUs == null) return durationFrames;
      const availableUs = ((durationUs - sourceInUs) * BigInt(rate.den)) / BigInt(rate.num);
      const max = frameAt(availableUs, fps, 'floor');
      if (durationFrames <= max) return durationFrames;
      report.time.clampedTails++;
      return Math.max(0, max);
    };

    // ── Geometry and appearance: v2 fields are the new format's fields, carried over as is ──────────────────
    const placeOf = (place: Obj | null | undefined, owner: string, keep: readonly string[] = PLACE_KEYS): Obj => {
      const out: Obj = {};
      for (const [key, value] of Object.entries(place ?? {})) {
        if (value == null) continue;
        if (!PLACE_KEYS.includes(key)) {
          drop(`place.${key}`, `元素 ${owner} 的 place.${key} 新格式没有，没有带过来`);
          continue;
        }
        if (!keep.includes(key)) continue;
        if (key === 'flipX' || key === 'flipY') {
          if (value === true) out[key] = true;
        } else if (key === 'opacity') {
          out.opacity = clampTo(report, 'place.opacity', Number(value), 0, 1);
        } else {
          out[key] = value;
        }
      }
      return out;
    };
    const pick = (element: Obj, keys: readonly string[]): Obj =>
      Object.fromEntries(keys.filter((key) => element[key] != null).map((key) => [key, element[key]]));
    const fade = (value: unknown, label: string): Obj => {
      if (typeof value !== 'number' || !(value > 0)) return {};
      return { [label]: mediaTime(micros(clampTo(report, label, value, 0, 5))) };
    };
    const isDefaultPlace = (place: Obj | null | undefined): boolean =>
      (place?.x ?? 50) === 50 &&
      (place?.y ?? 50) === 50 &&
      (place?.w ?? 100) === 100 &&
      (place?.scale ?? 1) === 1 &&
      (place?.scaleY ?? 1) === 1;

    // ── Film clock: clips plus the cuts of their sources (v2's arrange). Main-track clips and word anchors are both computed on it ──────
    interface Piece {
      id: string;
      clipId: string;
      srcId: string;
      srcStartUs: bigint;
      srcEndUs: bigint;
      tlStartUs: bigint;
      rate: Rate;
    }
    const legacyTracks = (timeline?.tracks ?? []) as Obj[];
    const mainLook: Obj = timeline?.main ?? {};
    const detached = mainLook.detached === true;
    const mainDurationUs = main?.durationUs ?? (media?.duration ? micros(media.duration) : 0n);
    const durationOf = (srcId: string): bigint | undefined => {
      if (srcId === 'main') return mainDurationUs > 0n ? mainDurationUs : undefined;
      const info = known.get(refOfSource.get(srcId) ?? '');
      return info?.durationUs ?? (typeof sources[srcId]?.duration === 'number' ? micros(sources[srcId].duration) : undefined);
    };
    const cutsOf = (srcId: string): Obj[] =>
      ((sources[srcId]?.cuts ?? []) as Obj[])
        .filter((cut) => typeof cut.t0 === 'number' && typeof cut.t1 === 'number' && cut.t1 > cut.t0)
        .sort((a, b) => a.t0 - b.t0);
    const clipList: { id: string; srcId: string; inUs: bigint; outUs?: bigint; rate: Rate }[] = timeline?.clips?.length
      ? (timeline.clips as Obj[]).map((clip) => ({
          id: String(clip.id),
          srcId: String(clip.srcId ?? 'main'),
          inUs: micros(clip.in ?? 0),
          outUs: clip.out != null ? micros(clip.out) : undefined,
          rate: rateOf(clip.rate),
        }))
      : mainDurationUs > 0n
        ? [{ id: 'c1', srcId: 'main', inUs: 0n, outUs: mainDurationUs, rate: { num: 1, den: 1 } }]
        : [];
    const pieces: Piece[] = [];
    let outputEndUs = 0n;
    for (const clip of clipList) {
      const out = clip.outUs ?? durationOf(clip.srcId);
      if (out == null) {
        report.warnings.push(`片段 ${clip.id} 没有终点、源 ${clip.srcId} 也不知道时长：没有导入`);
        continue;
      }
      let from = clip.inUs;
      const kept: [bigint, bigint][] = [];
      for (const cut of cutsOf(clip.srcId)) {
        const [t0, t1] = [micros(cut.t0), micros(cut.t1)];
        if (t1 <= from || t0 >= out) continue;
        if (t0 > from) kept.push([from, t0]);
        if (t1 > from) from = t1;
      }
      if (from < out) kept.push([from, out]);
      for (const [n, [srcStart, srcEnd]] of kept.entries()) {
        pieces.push({
          id: kept.length > 1 ? `${clip.id}#${n + 1}` : clip.id,
          clipId: clip.id,
          srcId: clip.srcId,
          srcStartUs: srcStart,
          srcEndUs: srcEnd,
          tlStartUs: outputEndUs,
          rate: clip.rate,
        });
        outputEndUs += ((srcEnd - srcStart) * BigInt(clip.rate.den)) / BigInt(clip.rate.num);
      }
    }

    // ── Word anchors (`~<source>:<word>[:start|:end][±offset]`): resolve the film time with the clock above, written as `speech-anchor` ──
    const words = new Map<string, { t0: bigint; t1: bigint }>(
      ((transcript?.words ?? []) as Obj[])
        .filter((w) => typeof w.t0 === 'number' && typeof w.t1 === 'number')
        .map((w) => [String(w.id), { t0: micros(w.t0), t1: micros(w.t1) }]),
    );
    const cutAt = (srcId: string, us: bigint): Obj | undefined => cutsOf(srcId).find((cut) => micros(cut.t0) <= us && us < micros(cut.t1));
    const sourceToTimeline = (srcId: string, us: bigint): bigint[] => {
      const found: bigint[] = [];
      for (const clipId of new Set(pieces.filter((p) => p.srcId === srcId).map((p) => p.clipId))) {
        const segments = pieces.filter((p) => p.clipId === clipId);
        const last = segments[segments.length - 1]!;
        const piece = segments.find((p) => p.srcStartUs <= us && us < p.srcEndUs) ?? (us === last.srcEndUs ? last : undefined);
        if (piece) found.push(piece.tlStartUs + ((us - piece.srcStartUs) * BigInt(piece.rate.den)) / BigInt(piece.rate.num));
      }
      return found;
    };
    const resolveAnchor = (raw: string): { us: bigint; anchor: Json } | string => {
      const match = ANCHOR.exec(raw);
      if (!match) return '写法不对';
      const [, srcId = "", wordId = "", edgeText, edgeOffset, plainOffset] = match;
      const edge = edgeText === 'end' ? 'end' : 'start';
      const word = srcId === 'main' ? words.get(wordId) : undefined;
      if (!word) return srcId === 'main' ? `转写里没有词 ${wordId}` : `源 ${srcId} 没有转写`;
      if (cutAt(srcId, (word.t0 + word.t1) / 2n)) return `词 ${wordId} 已经剪掉`;
      let at = edge === 'start' ? word.t0 : word.t1;
      const cut = cutAt(srcId, at);
      // The word is still there but an endpoint falls into a cut (only the word's head or tail is trimmed): snap the start to after the cut and the end to before it.
      if (cut) at = edge === 'start' ? micros(cut.t1) : micros(cut.t0);
      const placed = sourceToTimeline(srcId, at);
      if (placed.length === 0) return `词 ${wordId} 不在时间线上`;
      if (placed.length > 1) return `词 ${wordId} 在时间线上出现了 ${placed.length} 次`;
      const offsetText = edgeOffset ?? plainOffset;
      const offset = offsetText != null ? decimal(Number(offsetText)) : null;
      const us = placed[0]! + (offsetText != null ? micros(Number(offsetText)) : 0n);
      if (us < 0n) return '加上偏移之后在 0 秒之前';
      return {
        us,
        anchor: {
          kind: 'word',
          speechRef: SPEECH_REF,
          wordId,
          edge,
          ...(offset && offset.num !== 0n ? { offset: reduce(offset.num, offset.den) } : {}),
        },
      };
    };

    interface Timing {
      startUs: bigint;
      endUs: bigint | null;
      startAnchor?: Json;
      endAnchor?: Json;
    }
    const timings = new Map<Obj, Timing>();
    for (const track of legacyTracks) {
      for (const element of (track.elements ?? []) as Obj[]) {
        const resolve = (value: unknown, fallback: bigint | null): { us: bigint | null; anchor?: Json } | string => {
          if (value == null) return { us: fallback };
          if (typeof value === 'number') return Number.isFinite(value) ? { us: micros(value) } : `${value}：不是有限的秒数`;
          if (typeof value !== 'string') return '不是时间';
          const found = resolveAnchor(value);
          return typeof found === 'string' ? `${value}：${found}` : { us: found.us, anchor: found.anchor };
        };
        const start = resolve(element.start, 0n);
        const end = resolve(element.end, null);
        const failed = [start, end].filter((r): r is string => typeof r === 'string');
        if (failed.length > 0) {
          report.anchors.unresolved++;
          report.warnings.push(`元素 ${element.id} 的时间求不出来（${failed.join('；')}）：v2 也不画它，没有导入`);
          continue;
        }
        const s = start as { us: bigint; anchor?: Json };
        const e = end as { us: bigint | null; anchor?: Json };
        if (s.anchor || e.anchor) report.anchors.resolved++;
        timings.set(element, { startUs: s.us, endUs: e.us, startAnchor: s.anchor, endAnchor: e.anchor });
      }
    }
    // Elements without an end run to the film's end: film end = the latest end of the main track and the other elements.
    const contentEndUs = [outputEndUs, ...[...timings.values()].map((t) => t.endUs ?? t.startUs)].reduce((a, b) => (a > b ? a : b), 0n);

    // ── Cut sets: one per source that has cuts and is registered as an asset (video format spec §6.7) ────────────
    const cutSets: CutSetPlan[] = [];
    for (const srcId of Object.keys(sources)) {
      const ref = refOfSource.get(srcId);
      const cuts = cutsOf(srcId);
      if (cuts.length === 0 || !ref || !known.get(ref)) continue;
      const durationUs = durationOf(srcId);
      const exact = (value: number): { num: bigint; den: bigint } => {
        const d = decimal(value);
        if (d.den <= 1_000_000_000n) return d;
        count(report.clamped, '剪口时刻（超过纳秒精度，取到微秒）');
        return { num: micros(value), den: 1_000_000n };
      };
      const kept: { id: string; t0: { num: bigint; den: bigint }; t1: { num: bigint; den: bigint }; ref?: string }[] = [];
      let lastEndUs = -1n;
      for (const cut of cuts) {
        let t0 = exact(cut.t0);
        let t1 = exact(cut.t1);
        if (cut.t0 < 0) {
          t0 = { num: 0n, den: 1n };
          count(report.clamped, '剪口起点（负数）');
        }
        if (durationUs != null && micros(cut.t1) > durationUs) {
          t1 = { num: durationUs, den: 1_000_000n };
          count(report.clamped, '剪口终点（超出素材时长）');
        }
        if (t0.num * t1.den >= t1.num * t0.den || micros(cut.t0) < lastEndUs) {
          drop('剪口', `源 ${srcId} 的剪口 ${cut.id} 为空、在素材之外或与前一个重叠：没有写进剪口集合`);
          continue;
        }
        lastEndUs = micros(cut.t1);
        kept.push({ id: String(cut.id), t0, t1, ...(typeof cut.ref === 'string' ? { ref: cut.ref } : {}) });
      }
      if (kept.length === 0) continue;
      // Decimal seconds all have powers of 10 as denominators: the largest one represents every cut exactly.
      const timescale = kept.reduce((max, cut) => [max, cut.t0.den, cut.t1.den].reduce((a, b) => (a > b ? a : b)), 1n);
      const ticks = (t: { num: bigint; den: bigint }): string => String((t.num * timescale) / t.den);
      cutSets.push({
        ref: `cut-set:${srcId}`,
        name: `剪口（${srcId}）`,
        sourceAsset: ref,
        body: {
          schema: 'cuccut.cut-set/1',
          timescale: Number(timescale),
          clock: 'source-asset',
          cuts: kept.map((cut) => ({ id: cut.id, t0: ticks(cut.t0), t1: ticks(cut.t1), ...(cut.ref ? { ref: cut.ref } : {}) })),
        },
        scopeSourceIds: [],
      });
    }
    const cutSetOf = (srcId: string | undefined): CutSetPlan | undefined => cutSets.find((set) => set.ref === `cut-set:${srcId}`);

    // Collect the items of each old track first, then split overlapping ones into lanes.
    interface Pending {
      legacyTrack: string;
      trackName: string;
      kind: TrackPlan['kind'];
      plan: ItemPlan;
      start: number;
      end: number;
    }
    const pending: Pending[] = [];
    const push = (legacyTrack: string, trackName: string, plan: Omit<ItemPlan, 'track'>): void => {
      const item = plan.item as Obj;
      if (item.type === 'audio') {
        const offsetUs = (BigInt(item.subframeOffset.ticks) * 1_000_000n) / BigInt(item.subframeOffset.timescale);
        const startUs = frameStart(item.fromFrame, fps) + offsetUs;
        const playUs = (BigInt(item.playDuration.ticks) * 1_000_000n) / BigInt(item.playDuration.timescale);
        pending.push({
          legacyTrack,
          trackName,
          kind: 'audio',
          plan: { track: '', ...plan },
          start: Number(startUs),
          end: Number(startUs + playUs),
        });
      } else {
        const span = item.span as { fromFrame: number; durationFrames: number };
        const end = span.fromFrame + span.durationFrames;
        pending.push({ legacyTrack, trackName, kind: 'visual', plan: { track: '', ...plan }, start: span.fromFrame, end });
      }
    };

    /** Audio item: the start lands on a frame plus an exact offset within the frame, the length keeps its exact value; the source range stays within the asset. */
    const audioTiming = (startUs: bigint, endUs: bigint, srcStartUs: bigint, rate: Rate, info: AssetInfo, id: string): Obj | null => {
      let lengthUs = endUs - startUs;
      if (info.durationUs != null) {
        const maxUs = ((info.durationUs - srcStartUs) * BigInt(rate.den)) / BigInt(rate.num);
        if (lengthUs > maxUs) {
          lengthUs = maxUs;
          report.time.clampedTails++;
        }
      }
      if (lengthUs <= 0n) {
        report.warnings.push(`音频 ${id} 的源区间在素材之外，没有导入`);
        return null;
      }
      return { ...audioStart(startUs < 0n ? 0n : startUs, fps), playDuration: mediaTime(lengthUs), timeMap: linear(srcStartUs, rate) };
    };

    /** Span and source mapping of a picture item: the source start shifts by as much as the start snapped, so picture, sound and captions stay aligned on the same source instant. */
    const visualTiming = (
      startUs: bigint,
      endUs: bigint,
      srcStartUs: bigint,
      rate: Rate,
      info: AssetInfo | undefined,
      id: string,
    ): Obj | null => {
      const span = snap(startUs, endUs);
      let sourceInUs = srcStartUs + (span.shiftUs * BigInt(rate.num)) / BigInt(rate.den);
      if (sourceInUs < 0n) sourceInUs = 0n;
      const durationFrames = fitFrames(span.durationFrames, sourceInUs, rate, info?.durationUs);
      if (durationFrames <= 0) {
        report.warnings.push(`实例 ${id} 的源区间在素材之外，没有导入`);
        return null;
      }
      return { span: { fromFrame: span.fromFrame, durationFrames }, timeMap: linear(sourceInUs, rate) };
    };

    // ── Keyframes: visual properties become bindings on the sequence (`setKeyframes`), volume becomes the item's envelope ──────────
    const easeOf = (ease: unknown, owner: string): Obj => {
      if (ease == null) return {};
      if (typeof ease === 'string' && EASE_NAMES.includes(ease)) return { ease };
      drop('关键帧缓动', `元素 ${owner} 的关键帧缓动 ${String(ease)} 不在缓动表里：按线性`);
      return {};
    };
    const framesOf = (list: unknown, owner: string, property: string): Obj[] => {
      const all = Array.isArray(list) ? (list as Obj[]) : [];
      if (all.length > 256) drop('关键帧（每个属性最多 256 个）', `元素 ${owner} 的 ${property} 关键帧超过 256 个：只带前 256 个`);
      return all.slice(0, 256);
    };
    const percentOf = (t: unknown): number | null => {
      const match = typeof t === 'string' ? /^(\d+(?:\.\d+)?|\.\d+)%$/.exec(t) : null;
      return match ? clampTo(report, '关键帧时刻（百分比）', Number(match[1]), 0, 100) : null;
    };
    const visualKeyframes = (element: Obj, durationFrames: number, kind: string): KeyframePlan[] => {
      const out: KeyframePlan[] = [];
      const owner = String(element.id);
      for (const [property, list] of Object.entries((element.keyframes ?? {}) as Obj)) {
        if (list == null || (property === 'volume' && (kind === 'video' || kind === 'audio'))) continue;
        if (!KEYFRAME_PROPS.includes(property) || kind === 'audio') {
          drop(`关键帧 ${property}`, `元素 ${owner}（${kind}）的 ${property} 关键帧新格式放不下，没有带过来`);
          continue;
        }
        const keyframes: Obj[] = [];
        for (const frame of framesOf(list, owner, property)) {
          const percent = percentOf(frame.t);
          const time =
            percent != null
              ? { percent }
              : typeof frame.t === 'number' && Number.isFinite(frame.t)
                ? { localFrame: clampTo(report, '关键帧时刻（超出实例）', frameAt(micros(frame.t), fps), 0, durationFrames) }
                : null;
          if (!time || typeof frame.v !== 'number') {
            drop('关键帧（时刻或数值不对）', `元素 ${owner} 的一个 ${property} 关键帧时刻或数值不对，没有带过来`);
            continue;
          }
          // After seconds land on frames a keyframe may coincide with the previous one: the new format requires strictly increasing frames, so only the earlier one is kept.
          const previous = keyframes[keyframes.length - 1];
          if (previous && time.localFrame != null && previous.localFrame >= time.localFrame) {
            drop('关键帧（落到同一帧）', `元素 ${owner} 的 ${property} 有两个关键帧落在同一帧上：只留前一个`);
            continue;
          }
          const value =
            property === 'opacity'
              ? clampTo(report, '关键帧 opacity', frame.v, 0, 1)
              : property === 'radius'
                ? clampTo(report, '关键帧 radius', frame.v, 0, Number.MAX_VALUE)
                : frame.v;
          keyframes.push({ ...time, value, ...easeOf(frame.ease, owner) });
        }
        if (keyframes.length > 0) out.push({ property, keyframes: keyframes as Json[] });
      }
      return out;
    };
    const envelopeOf = (element: Obj): Obj => {
      const owner = String(element.id);
      const points: Obj[] = [];
      for (const frame of framesOf(element.keyframes?.volume, owner, 'volume')) {
        const percent = percentOf(frame.t);
        const time =
          percent != null
            ? { percent }
            : typeof frame.t === 'number' && Number.isFinite(frame.t)
              ? { at: mediaTime(micros(clampTo(report, '音量包络时刻（负数）', frame.t, 0, Number.MAX_VALUE))) }
              : null;
        if (!time || typeof frame.v !== 'number') {
          drop('关键帧（时刻或数值不对）', `元素 ${owner} 的一个音量关键帧时刻或数值不对，没有带过来`);
          continue;
        }
        points.push({ ...time, volume: clampTo(report, '音量关键帧', frame.v, 0, 4), ...easeOf(frame.ease, owner) });
      }
      return points.length > 0 ? { envelope: points } : {};
    };

    /** Sound: v2 volume is a linear gain, same as the new format. */
    const sound = (element: Obj): Obj => ({
      volume: typeof element.volume === 'number' ? clampTo(report, 'volume', element.volume, 0, 4) : 1,
      ...fade(element.audioFadeIn, 'fadeIn'),
      ...fade(element.audioFadeOut, 'fadeOut'),
      ...envelopeOf(element),
    });

    // ── Ducking: merged by (trigger, depth, attack/release) into rules on the sequence ─────────────────────
    const ducking = new Map<string, DuckingPlan>();
    const addDuck = (element: Obj, sourceId: string): void => {
      const duck = element.duck as Obj | undefined;
      if (!duck) return;
      if (typeof duck.under !== 'string' || !duck.under.trim() || duck.under === 'none') {
        drop('闪避', `元素 ${sourceId} 的闪避没有触发来源，没有带过来`);
        return;
      }
      const ramp = (value: unknown, label: string): Obj =>
        typeof value === 'number' ? { [label]: decimalText(clampTo(report, `闪避 ${label}`, value, 0, 5)) } : {};
      const plan: Omit<DuckingPlan, 'targetSourceIds'> = {
        trigger: duck.under === 'speech' ? { kind: 'speech' } : { kind: 'tracks', legacyTrack: duck.under },
        ...(typeof duck.depth === 'number' ? { depth: clampTo(report, '闪避深度', duck.depth, 0, 60) } : {}),
        ...ramp(duck.attack, 'attack'),
        ...ramp(duck.release, 'release'),
      };
      const key = JSON.stringify(plan);
      const existing = ducking.get(key);
      if (existing) existing.targetSourceIds.push(sourceId);
      else ducking.set(key, { ...plan, targetSourceIds: [sourceId] });
    };

    // ── Transitions: v2 video elements' in / out -> single-sided transitions ─────────────────────────────
    const transitionsOf = (element: Obj, kind: string): TransitionPlan[] => {
      const out: TransitionPlan[] = [];
      for (const side of ['in', 'out'] as const) {
        const t = element.transitions?.[side] as Obj | undefined;
        if (!t || t.k === 'none') continue;
        if (kind !== 'video' || !TRANSITION_KINDS.includes(t.k)) {
          drop('转场', `元素 ${element.id}（${kind}）的 ${side} 转场 ${String(t.k)} 新格式放不下，没有带过来`);
          continue;
        }
        const seconds = typeof t.dur === 'number' ? clampTo(report, '转场长度', t.dur, 0.1, 2) : 0.5;
        out.push({ side, kind: t.k, duration: decimalText(seconds) });
      }
      return out;
    };

    /** The film rendered by a code project: a composition item with a prerender proxy. When the film already has the voiceover mixed in and the timeline has separate voiceover items, the proxy's sound is turned off. */
    const dubbed = legacyTracks.some((t) => ((t.elements ?? []) as Obj[]).some((e) => e.kind === 'audio'));
    const renderedComposition = (timing: Obj, place: Obj, info: AssetInfo | undefined, audio: Obj, extra: Obj): Obj => {
      if (dubbed && audio.enabled) report.warnings.push('渲染结果里已经混入配音，时间线上另有配音实例：预渲染替身的声音已关掉');
      return {
        type: 'composition',
        ...timing,
        place,
        source: { kind: 'bundle', assetRef: assetRef(bundle as AssetInfo) },
        parameterValues: {},
        ...(info?.kind === 'video' ? { prerender: assetRef(info), audio: { ...audio, enabled: audio.enabled && !dubbed } } : {}),
        ...extra,
      };
    };

    // ── Main track: old documents without detached media; picture and sound are carried by clips ──
    const hasVideoElements = legacyTracks.some((t) => ((t.elements ?? []) as Obj[]).some((e) => e.kind === 'video' && e.srcId === 'main'));
    const hex = (value: unknown): string | undefined =>
      typeof value === 'string' && /^#[0-9a-fA-F]{6}$/.test(value) ? value.toUpperCase() : undefined;
    if (!detached && !hasVideoElements) {
      // When the main picture was not moved it fills the canvas with contain, and `bg` is v2's full-canvas background; when moved it is picture-in-picture and a solid background lands on the canvas background color.
      const fills = isDefaultPlace(mainLook.place);
      const look: Obj = fills
        ? { mode: 'fullscreen', fit: 'contain', bg: mainLook.background ?? 'black' }
        : { mode: 'pip', fit: 'contain' };
      if (!fills) {
        background = hex(mainLook.background);
        if (mainLook.background === 'blur')
          drop('main.background', '主画面挪动或缩放过：模糊背景在新格式里只对铺满画布的画面生效，没有带过来');
      }
      const place = placeOf(mainLook.place, 'main', fills ? ['rot', 'opacity', 'radius', 'cornerRadii', 'flipX', 'flipY'] : PLACE_KEYS);
      for (const piece of pieces) {
        const info = known.get(refOfSource.get(piece.srcId) ?? '');
        if (!info) {
          report.warnings.push(`片段 ${piece.id} 的源 ${piece.srcId} 没有登记成素材，没有导入`);
          continue;
        }
        const endUs = piece.tlStartUs + ((piece.srcEndUs - piece.srcStartUs) * BigInt(piece.rate.den)) / BigInt(piece.rate.num);
        const extra = { role: 'a-roll', extensions: { 'cuccut.import': { sourceId: piece.id } } };
        if (info.kind === 'audio') {
          const timing = audioTiming(piece.tlStartUs, endUs, piece.srcStartUs, piece.rate, info, piece.id);
          if (!timing) continue;
          const mix = { volume: 1, ...(mainLook.muted === true ? { muted: true } : {}) };
          push('main', '原声', { sourceId: piece.id, item: { type: 'audio', assetRef: assetRef(info), ...timing, mix, ...extra } });
        } else {
          const timing = visualTiming(piece.tlStartUs, endUs, piece.srcStartUs, piece.rate, info, piece.id);
          if (!timing) continue;
          const audio = { enabled: mainLook.muted !== true && info.hasAudio, volume: 1 };
          const item =
            piece.srcId === 'main' && mainIsRender && bundle
              ? renderedComposition(timing, place, info, audio, extra)
              : { type: 'video', ...timing, place, ...look, assetRef: assetRef(info), embeddedAudio: audio, ...extra };
          push('main', '视频', { sourceId: piece.id, item });
        }
        if (piece.srcId === 'main') mainSourceIds.push(piece.id);
        cutSetOf(piece.srcId)?.scopeSourceIds.push(piece.id);
      }
    } else {
      // In a detached document the picture is an ordinary element: v2's full-canvas solid color is the canvas background color.
      background = hex(mainLook.background);
    }

    // ── Elements ────────────────────────────────────────────────────────
    for (const track of legacyTracks) {
      const trackId = String(track.id);
      const trackName = String(track.name ?? TRACK_NAMES[trackId] ?? trackId);
      const trackRole = trackId.startsWith('dub') ? 'dub' : trackId.startsWith('bed') ? 'music' : undefined;
      for (const element of (track.elements ?? []) as Obj[]) {
        const timing = timings.get(element);
        if (!timing) continue;
        const id = String(element.id);
        const open = timing.endUs == null;
        const endUs = timing.endUs ?? contentEndUs;
        if (endUs <= timing.startUs) {
          report.warnings.push(`元素 ${id} 没有长度，没有导入`);
          continue;
        }
        const srcId = typeof element.srcId === 'string' ? element.srcId : undefined;
        const source = srcId ? sources[srcId] : undefined;
        const info = srcId ? known.get(refOfSource.get(srcId) ?? '') : undefined;
        const isMain = srcId === 'main';
        const cutSet = cutSetOf(srcId);
        const anchored = timing.startAnchor != null || timing.endAnchor != null;
        const role = typeof element.role === 'string' ? element.role : trackRole;
        const srcStartUs = micros(typeof element.srcStart === 'number' ? element.srcStart : 0);
        const rate = rateOf(element.rate);

        // Follow: word anchors -> speech-anchor; no end -> to the sequence end, fixed to sequence time; other items placed by time follow the cuts
        // (v2's default and the engine's default; stated explicitly when there is a cut set).
        const follow = (inScope: boolean, untilEnd: boolean): Obj => {
          if (anchored) {
            const policy = {
              kind: 'speech-anchor',
              ...(timing.startAnchor ? { start: timing.startAnchor } : {}),
              ...(timing.endAnchor ? { end: timing.endAnchor } : {}),
            };
            return { followPolicy: policy, ...(untilEnd ? { untilSequenceEnd: true } : {}) };
          }
          // v2: elements without an end do not move with cuts; the engine defaults to follow-cuts, so sequence-fixed must be stated.
          if (untilEnd) return { followPolicy: { kind: 'sequence-fixed' }, untilSequenceEnd: true };
          return cutSets.length > 0 && !inScope ? { followPolicy: { kind: 'follow-cuts' } } : {};
        };
        const base = (extra: Obj = {}): Obj => ({
          ...(element.name ? { name: String(element.name).slice(0, 200) } : {}),
          ...(role ? { role } : {}),
          ...(element.ai != null ? { ai: element.ai } : {}),
          ...(element.hidden === true ? { enabled: false } : {}),
          extensions: { 'cuccut.import': { sourceId: id, ...extra } },
        });
        const missing = (what: string): void =>
          drop(`${what}（源没有登记）`, `${what} ${id} 的源 ${String(srcId)} 没有登记成素材，没有导入`);

        const audioElement = (assetInfo: AssetInfo, extra: Obj = {}): void => {
          // Audio items have no "to the sequence end": without an end they run to the film end at import time.
          if (open) count(report.estimated, '没有终点的音频（取到导入时的片尾）');
          const t = audioTiming(timing.startUs, endUs, srcStartUs, rate, assetInfo, id);
          if (!t) return;
          visualKeyframes(element, 0, 'audio');
          transitionsOf(element, 'audio');
          const mix = { ...sound(element), ...(element.muted === true ? { muted: true } : {}) };
          const inScope = cutSet != null;
          push(trackId, trackName, {
            sourceId: id,
            item: { type: 'audio', assetRef: assetRef(assetInfo), ...t, mix, ...follow(inScope, false), ...base(extra) },
          });
          if (inScope) cutSet.scopeSourceIds.push(id);
          if (isMain) mainSourceIds.push(id);
          addDuck(element, id);
        };

        const visual = (type: string, fields: Obj, options: { timing?: Obj; media?: boolean } = {}): void => {
          const snapped = snap(timing.startUs, endUs);
          const t = options.timing ?? { span: { fromFrame: snapped.fromFrame, durationFrames: snapped.durationFrames } };
          const inScope = cutSet != null && (type === 'video' || type === 'composition');
          const keyframes = visualKeyframes(element, (t.span as { durationFrames: number }).durationFrames, type);
          const transitions = transitionsOf(element, type);
          if (element.duck && type !== 'video' && type !== 'composition') drop('闪避', `元素 ${id}（${type}）没有声音，闪避没有带过来`);
          push(trackId, trackName, {
            sourceId: id,
            item: {
              type,
              ...t,
              place: placeOf(element.place, id),
              ...(element.animate != null ? { animate: element.animate } : {}),
              ...(options.media ? pick(element, MEDIA_KEYS) : {}),
              ...fields,
              ...follow(inScope, open),
              ...base(),
            },
            ...(keyframes.length > 0 ? { keyframes } : {}),
            ...(transitions.length > 0 ? { transitions } : {}),
          });
          if (inScope) cutSet.scopeSourceIds.push(id);
        };

        switch (element.kind) {
          case 'video': {
            if (!info) {
              missing('视频元素');
              break;
            }
            if (info.kind === 'audio') {
              audioElement(info);
              break;
            }
            const t = visualTiming(timing.startUs, endUs, srcStartUs, rate, info, id);
            if (!t) break;
            const audio = { enabled: element.muted !== true && info.hasAudio, ...sound(element) };
            if (isMain && mainIsRender && bundle) {
              visual('composition', renderedComposition({}, {}, info, audio, pick(element, ['mask', 'fx'])), { timing: t });
            } else {
              // In a detached document the main video's picture is an ordinary video element: one without a role counts as a-roll.
              const roleFix = isMain && role == null ? { role: 'a-roll' } : {};
              visual('video', { assetRef: assetRef(info), embeddedAudio: audio, ...roleFix }, { timing: t, media: true });
            }
            if (isMain) mainSourceIds.push(id);
            addDuck(element, id);
            break;
          }
          case 'audio': {
            if (!info) {
              missing('音频元素');
              break;
            }
            // `bcfClip`: which spoken line of the code composition this voiceover claims; the composition and the voiceover claiming it are later grouped into a linked audio-picture group.
            audioElement(info, element.bcfClip ? { bcfClip: element.bcfClip } : {});
            break;
          }
          case 'image':
            if (!info || info.kind !== 'image') missing('图片元素');
            else visual('image', { assetRef: assetRef(info), ...pick(element, ['tile', 'source', 'html']) }, { media: true });
            break;
          case 'text':
            visual('text', {
              ...(element.counter != null ? { counter: element.counter } : {}),
              ...(element.text != null || element.counter == null ? { text: String(element.text ?? '') } : {}),
              ...pick(element, ['style', 'stylePresetId', 'verticalAlign', 'tile']),
            });
            break;
          case 'shape':
            visual('shape', { shape: element.shape ?? {} });
            break;
          case 'sticker': {
            const sticker: Obj = element.sticker ?? {};
            if (sticker.source !== 'asset') visual('sticker', { sticker });
            else if (info && (info.kind === 'image' || info.kind === 'video' || info.kind === 'lottie')) {
            // `loop` (loop/once/hold) and `fillOverrides` are carried over as is with `sticker`; stickers take their source by time elapsed since the item start, so v2's source start and rate have no counterpart.
              if (srcStartUs !== 0n || rate.num !== rate.den)
                drop('贴纸的取源起点与速度', `贴纸 ${id} 的 srcStart/rate 没有带过来：贴纸从源的开头按原速播放`);
              visual('sticker', { sticker, assetRef: assetRef(info) }, { media: true });
            } else missing('贴纸');
            break;
          }
          case 'visualizer':
          case 'progress':
          case 'draw':
          case 'confetti':
            visual(element.kind, { [element.kind]: element[element.kind] ?? {} });
            break;
          case 'placeholder':
            if (srcId && !info) missing('占位框');
            else
              visual(
                'placeholder',
                { placeholder: element.placeholder ?? {}, ...(info ? { assetRef: assetRef(info) } : {}) },
                { media: true },
              );
            break;
          case 'whiteboard':
            if (!info || info.kind !== 'image') missing('白板');
            else visual('whiteboard', { whiteboard: element.whiteboard ?? {}, assetRef: assetRef(info) }, { media: true });
            break;
          default:
            drop(`元素类型 ${String(element.kind)}`, `元素 ${id} 的类型 ${String(element.kind)} 新格式没有，没有导入`);
        }
      }
    }

    // ── Code project without a timeline file: the whole thing is one composition item whose proxy is the rendered film ──────────
    if (isCode && pending.every((p) => p.kind !== 'visual')) {
      const timing =
        bundle && mainIsRender && main?.kind === 'video' && main.durationUs
          ? visualTiming(0n, main.durationUs, 0n, { num: 1, den: 1 }, main, 'composition')
          : null;
      if (timing) {
        const extra = { extensions: { 'cuccut.import': { sourceId: 'composition' } } };
        const audio = { enabled: main?.hasAudio ?? false, volume: 1 };
        push('main', '视频', { sourceId: 'composition', item: renderedComposition(timing, {}, main, audio, extra) });
        mainSourceIds.push('composition');
      } else {
        const composition = typeof compiled?.meta?.id === 'string' ? compiled.meta.id : 'composition';
        drop(
          '没有预渲染替身的代码合成',
          `项目「${name}」的代码合成 ${composition} 没有找到渲染出来的成片：新格式的代码合成要有预渲染替身，没有导入${bundle ? '' : '，代码包也没有登记'}`,
        );
      }
    }

    // ── Compositions claimed by voiceover (bcfClip): the composition item and the voiceover items claiming its lines go into one linked audio-picture group ─────────
    // The voiceover in the group is the composition's sound as a separate copy, and the composition's sound is off (spec §3.7). v2 only subtracts the claimed lines from the composition's sound; the proxy is a mixed
    // film from which single lines cannot be removed, so it is turned off entirely (`dubbed` above already did that).
    const claimed = pending.filter((p) => (p.plan.item.extensions as Obj | undefined)?.['cuccut.import']?.bcfClip != null);
    if (claimed.length > 0) {
      const compositions = pending.filter((p) => (p.plan.item as Obj).type === 'composition');
      if (compositions.length > 0) {
        const linkGroupId = `narration:${typeof compiled?.meta?.id === 'string' ? compiled.meta.id : 'composition'}`;
        for (const p of compositions) {
          const item = p.plan.item as Obj;
          item.linkGroupId = linkGroupId;
          if (item.audio) item.audio = { ...item.audio, enabled: false };
        }
        for (const p of claimed) (p.plan.item as Obj).linkGroupId = linkGroupId;
        count(report.written, '音画联动组（合成与认领它口播的配音，bcfClip）');
        count(report.written, '归进音画联动组的配音（bcfClip）', claimed.length);
      } else {
        count(report.notApplicable, 'bcfClip（认领的代码合成没有导入，配音按普通音频导入）', claimed.length);
      }
    }

    // ── Lane splitting: overlapping elements on the same old track go onto several adjacent new tracks ──────────────
    const legacyTrackKeys: Record<string, string[]> = {};
    const groupOf = (p: Pending): string => `${p.kind}\u0000${p.legacyTrack}`;
    const groups = new Map<string, Pending[]>();
    for (const p of pending) groups.set(groupOf(p), [...(groups.get(groupOf(p)) ?? []), p]);
    const names = new Set<string>();
    const order = (p: Pending[]): number =>
      p[0]!.legacyTrack === 'main' ? -1 : legacyTracks.findIndex((t) => String(t.id) === p[0]!.legacyTrack);
    for (const kindOf of ['visual', 'audio'] as const) {
      const ofKind = [...groups.values()].filter((g) => g[0]!.kind === kindOf).sort((a, b) => order(a) - order(b));
      for (const group of ofKind) {
        const lane = lanes(group);
        const laneCount = Math.max(...lane) + 1;
        if (laneCount > 1) report.warnings.push(`旧轨道 ${group[0]!!.legacyTrack} 上有重叠的元素：分成了 ${laneCount} 条轨道`);
        const legacy = legacyTracks.find((t) => String(t.id) === group[0]!!.legacyTrack);
        for (let n = 0; n < laneCount; n++) {
          const key = `${groupOf(group[0]!)}\u0000${n}`;
          let trackName = n === 0 ? group[0]!!.trackName : `${group[0]!!.trackName} ${n + 1}`;
          while (names.has(`${kindOf}:${trackName}`)) trackName += '′';
          names.add(`${kindOf}:${trackName}`);
          tracks.push({
            key,
            kind: kindOf,
            name: trackName,
            ...(legacy?.hidden === true ? { hidden: true } : {}),
            ...(legacy?.muted === true ? { muted: true } : {}),
            ...(legacy?.locked === true ? { locked: true } : {}),
          });
          (legacyTrackKeys[group[0]!!.legacyTrack] ??= []).push(key);
        }
        group.forEach((p, i) => items.push({ ...p.plan, track: `${groupOf(p)}\u0000${lane[i]}` }));
      }
    }

    // ── Template layers: objects on the sequence, carried over as is ──────────────────────────────────
    const template: Obj | undefined = timeline?.template ?? undefined;
    if (template) {
      const files = ((template.layers ?? []) as Obj[]).filter((layer) => typeof layer?.src?.file === 'string');
      if (files.length > 0)
        report.warnings.push(
          `模板层里有 ${files.length} 个台标图片是旧项目里的相对路径（${files.map((l) => l.src.file).join('、')}）：模板层不登记素材，视频目录里没有这些文件`,
        );
    }

    // ── Documents: transcript, translations, captions, caption styles, export records ──────────────────────
    const totalFrames = Math.max(0, ...pending.map((p) => (p.kind === 'visual' ? p.end : frameAt(BigInt(Math.round(p.end)), fps, 'ceil'))));
    if (transcript) addTranscript(documents, tracks, items, { main, totalFrames, mainSourceIds });
    addExports(documents, known);
    return {
      documents,
      tracks,
      items,
      legacyTracks: legacyTrackKeys,
      ducking: [...ducking.values()],
      cutSets,
      ...(template ? { template: template as Json } : {}),
      ...(background && background !== '#000000' ? { background } : {}),
    };
  }

  function addTranscript(
    documents: DocumentPlan[],
    tracks: TrackPlan[],
    items: ItemPlan[],
    ctx: { main: AssetInfo | undefined; totalFrames: number; mainSourceIds: string[] },
  ): void {
    const t = transcript as Obj;
    const words = (t.words ?? []) as Obj[];
    const indexOf = new Map<string, number>(words.map((w, i) => [String(w.id), i]));
    const language = typeof t.lang === 'string' ? t.lang : undefined;
    const speakers = Object.entries((t.speakers ?? {}) as Record<string, Obj>).map(([id, s]) => ({
      id,
      name: s?.name ?? id,
      hue: s?.hue ?? null,
    }));

    // Sentences and paragraphs: the old format does not store them but computes them with the normative algorithm; the editor saves the computed result in studio/data.json, which is taken here as is without recomputing.
    const fresh = (list: Obj[] | undefined, ids: (entry: Obj) => string[]): Obj[] | null => {
      if (!list?.length) return null;
      const stale = list.some((entry) => ids(entry).length === 0 || ids(entry).some((id) => !indexOf.has(id)));
      return stale ? null : list;
    };
    // Older studio projections store only cueIds; each caption line must be found to restore its word members, rather than treating missing fields as empty sentences.
    const cueById = new Map<string, Obj>(((studio?.cues ?? []) as Obj[]).map((cue) => [String(cue.id), cue]));
    const sentenceWords = (sentence: Obj): string[] => {
      if (Array.isArray(sentence.sourceWordIds) && sentence.sourceWordIds.length > 0) return sentence.sourceWordIds;
      const ids = sentence.cueIds as string[] | undefined;
      if (!ids?.length || ids.some((id) => !cueById.get(id)?.words?.length)) return [];
      return [...new Set(ids.flatMap((id) => (cueById.get(id)!.words as Obj[]).map((word) => String(word.id))))];
    };
    const projectedSentences = (studio?.sentences as Obj[] | undefined)?.map((sentence) => ({
      ...sentence,
      sourceWordIds: sentenceWords(sentence),
    }));
    const sentences = fresh(projectedSentences, (s) => s.sourceWordIds);
    const cues = fresh(studio?.cues, (c) => ((c.words ?? []) as Obj[]).map((w) => String(w.id)));
    if (studio && words.length > 0 && (!sentences || !cues)) {
      report.warnings.push('studio/data.json 里的句子或字幕行缺少词引用，或引用了转写里已经没有的词（投影过期）：对应的句子切分或字幕行没有导入');
    }
    const range = (ids: string[]): Obj => {
      const first = indexOf.get(ids[0]!) as number;
      return ids.every((id, i) => indexOf.get(id) === first + i)
        ? { first: ids[0], last: ids[ids.length - 1] }
        : { wordIds: ids };
    };
    const pins = (table: Obj): Obj =>
      Object.fromEntries(Object.entries(table).map(([id, value]) => [id, value === 'nobreak' ? 'no-break' : value]));
    documents.push({
      ref: 'speech',
      kind: 'speech',
      name: '转写',
      language,
      sourceAsset: ctx.main ? 'main' : undefined,
      body: {
        schema: 'cuccut.speech/1',
        clock: 'source-asset',
        timescale: 1_000_000,
        engine: t.engine ?? null,
        createdAt: t.createdAt ?? null,
        speakers,
        words: words.map((w) => ({
          id: String(w.id),
          start: Number(micros(w.t0)),
          end: Number(micros(w.t1)),
          text: String(w.text ?? ''),
          ...(w.sp ? { speaker: String(w.sp) } : {}),
          ...(t.hidden?.[w.id] ? { hidden: true } : {}),
          ...(w.glue === true ? { glue: true } : {}),
        })),
        sentences: sentences
          ? sentences.map((s) => ({ id: String(s.id), ...range(s.sourceWordIds), ...(s.paraStart ? { paragraphStart: true } : {}) }))
          : null,
        chapters: ((t.chapters ?? []) as Obj[]).map((c) => ({
          id: String(c.id),
          title: String(c.title ?? ''),
          start: Number(micros(c.start)),
          end: Number(micros(c.end)),
        })),
        userBreaks: pins(t.breaks ?? {}),
        autoBreaks: Object.fromEntries(Object.entries(t.autoBreaks ?? {}).map(([profile, table]) => [profile, pins(table as Obj)])),
        paragraphBreaks: Object.entries(t.paraBreaks ?? {}).filter(([, on]) => on === true).map(([id]) => id),
        ...(t.stages ? { stages: t.stages } : {}),
      } as Json,
      summary: {
        wordCount: words.length,
        speakerCount: speakers.length,
        sentenceCount: sentences?.length ?? null,
        chapterCount: t.chapters?.length ?? 0,
      },
    });

    const translated = Object.keys((t.trans ?? {}) as Obj);
    for (const lang of translated) {
      const table = t.trans[lang] as Record<string, string>;
      const firstWord = (sid: string): number =>
        indexOf.get(String(t.transSrc?.[lang]?.[sid] ?? '').split(':')[1] ?? sid.replace(/^s-/, '')) ?? Number.MAX_SAFE_INTEGER;
      const units = Object.keys(table)
        .sort((a, b) => firstWord(a) - firstWord(b))
        .map((sid) => {
          const [wordCount, first, last, fingerprint] = String(t.transSrc?.[lang]?.[sid] ?? '').split(':');
          return {
            id: sid,
            text: table[sid],
            ...(t.transDisplay?.[lang]?.[sid]?.text ? { display: t.transDisplay[lang][sid].text } : {}),
            ...(first ? { source: { first, last, wordCount: Number(wordCount), fingerprint } } : {}),
            ...(t.transAlign?.[lang]?.[sid] ? { alignment: t.transAlign[lang][sid] } : {}),
          };
        });
      documents.push({
        ref: `translation:${lang}`,
        kind: 'translation',
        name: `译文 ${lang}`,
        language: lang,
        sourceDocument: 'speech',
        body: { schema: 'cuccut.translation/1', sourceLanguage: language ?? null, units } as Json,
        summary: { unitCount: units.length, alignedCount: units.filter((u) => 'alignment' in u).length },
      });
    }

    // Caption lines: one copy for the original, one per translation. Times are on the source asset's clock and projected to video time through the timeline items that reference that asset.
    const style: Obj | null = loadJson(path.join(dir, 'studio', 'style.json')) ?? studio?.style ?? null;
    const captionDocs: { ref: string; role: string }[] = [];
    if (cues) {
      documents.push({
        ref: 'caption:source',
        kind: 'caption',
        name: '字幕（原文）',
        language,
        sourceDocument: 'speech',
        body: {
          schema: 'cuccut.caption/1',
          clock: 'source-asset',
          timescale: 1_000_000,
          cues: cues.map((c) => ({
            id: String(c.id),
            start: Number(micros(c.start)),
            end: Number(micros(c.end)),
            text: String(c.text ?? ''),
            ...(c.sp ? { speaker: String(c.sp) } : {}),
            words: range(((c.words ?? []) as Obj[]).map((w) => String(w.id))),
            ...(c.paraStart ? { paragraphStart: true } : {}),
          })),
        } as Json,
        summary: { cueCount: cues.length },
      });
      captionDocs.push({ ref: 'caption:source', role: 'source' });
    }
    const transCues = (studio?.transCues ?? []) as Obj[];
    const targetLang = studio?.meta?.targetLang?.code ?? translated[0];
    if (sentences && transCues.length > 0 && targetLang && translated.includes(targetLang)) {
      documents.push({
        ref: `caption:${targetLang}`,
        kind: 'caption',
        name: `字幕（${targetLang}）`,
        language: targetLang,
        sourceDocument: `translation:${targetLang}`,
        body: {
          schema: 'cuccut.caption/1',
          clock: 'source-asset',
          timescale: 1_000_000,
          cues: transCues.map((c) => ({
            id: String(c.id),
            start: Number(micros(c.start)),
            end: Number(micros(c.end)),
            text: String(c.text ?? ''),
            unit: String(c.sid ?? c.id),
            ...(c.kind && c.kind !== 'sentence' ? { split: String(c.kind) } : {}),
          })),
        } as Json,
        summary: { cueCount: transCues.length },
      });
      captionDocs.push({ ref: `caption:${targetLang}`, role: 'translation' });
    }
    if (style && captionDocs.length > 0) {
      documents.push({
        ref: 'caption-style',
        kind: 'caption-style',
        name: '字幕样式',
        body: { schema: 'cuccut.legacy-studio-style/0.1', style } as Json,
      });
    }
    if (captionDocs.length === 0) return;
    if (ctx.mainSourceIds.length === 0 || ctx.totalFrames <= 0) {
      report.warnings.push('时间线上没有主媒体的片段：字幕文档已导入，但没有放上时间线');
      return;
    }
    // The old style's display mode (original / translation / bilingual) decides which caption track is enabled.
    const mode = style?.mode;
    const shown = (role: string): boolean =>
      mode === 'bi' || mode == null || (mode === 'orig' && role === 'source') || (mode === 'trans' && role === 'translation');
    for (const doc of captionDocs) {
      const key = `subtitle\u0000${doc.ref}`;
      tracks.push({ key, kind: 'subtitle', name: doc.role === 'source' ? '字幕' : '字幕（译文）' });
      items.push({
        track: key,
        sourceId: doc.ref,
        item: {
          type: 'caption',
          span: { fromFrame: 0, durationFrames: ctx.totalFrames },
          enabled: shown(doc.role) || captionDocs.length === 1,
          role: doc.role,
          extensions: { 'cuccut.import': { sourceId: doc.ref } },
        },
        document: doc.ref,
        styleDocument: style ? 'caption-style' : undefined,
        scopeSourceIds: ctx.mainSourceIds,
      });
    }
  }

  /** Films and caption files the old project exported: only record where they are, without moving them or treating them as assets. */
  function addExports(documents: DocumentPlan[], known: Map<string, AssetInfo>): void {
    const files: string[] = [];
    const scan = (rel: string, pattern: RegExp): void => {
      const full = path.join(dir, rel);
      if (!existsSync(full)) return;
      for (const entry of readdirSync(full, { withFileTypes: true })) {
        if (entry.isFile() && pattern.test(entry.name) && !entry.name.startsWith('.')) files.push(path.join(full, entry.name));
      }
    };
    scan('exports', /./);
    scan('out', /\.(mp4|mov|srt|vtt|md|txt)$/i);
    scan('.', /\.(mp4|mov|srt|vtt)$/i);
    if (files.length === 0) return;
    const prerender = media?.path && known.get('main') ? { path: media.path, assetId: known.get('main')?.id } : null;
    documents.push({
      ref: 'exports',
      kind: 'export-record',
      name: '导出记录',
      body: {
        schema: 'cuccut.export-record/1',
        exports: files.sort().map((file) => {
          const stat = statSync(file);
          return {
            file: { path: file, byteLength: stat.size, modifiedAt: new Date(stat.mtimeMs).toISOString() },
            format: path.extname(file).slice(1).toLowerCase(),
            ...(prerender && prerender.path === file ? { assetId: prerender.assetId as string } : {}),
          };
        }),
      } as Json,
      summary: { fileCount: files.length },
    });
  }
}
