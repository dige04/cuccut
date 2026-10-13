// External video project directory (`project.json` + `runtime-media/` + `projects/<id>/assets/hyperframes/`) → video plan.
//
// Times in this kind of project are already on the frame grid (`from` / `durationInFrames` / `sourceStart`, at 30 fps), so the conversion is exact:
// - `hyperframes` instances (code compositions) are not imported: this kind of project does not record render results of code packages, compositions have no pre-rendered stand-ins, and code packages are not registered either;
// - `audio` instance → audio instance, dB converted to linear multiplier, volume keyframes → envelope;
// - `subtitle` instances (one per sentence, each with its own style) → one subtitle document + one style document + one subtitle instance.

import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import path from 'node:path';

import { linearOfDb, mediaTime, micros, rateOf, reduce } from './exact-time.ts';
import type { Rate } from './exact-time.ts';
import { EASE_NAMES, clampTo, count, dirNameOf, newReport, uniqueName } from './video-plan.ts';
import type { AssetInfo, AssetPlan, DocumentPlan, ItemPlan, Json, VideoContent, ProjectPlan, TrackPlan } from './video-plan.ts';

type Obj = { [key: string]: any };

function readJson(file: string): Obj | null {
  if (!existsSync(file)) return null;
  try {
    return JSON.parse(readFileSync(file, 'utf8')) as Obj;
  } catch {
    return null;
  }
}

const SIDECARS: [string, string][] = [
  ['command-history.json', '编辑命令历史'],
  ['author-work', '智能体写代码包时的工作目录'],
  ['workspace.snapshot.sqlite', '工作区数据库快照'],
  ['motion-graphics-ledger.json', '动效生成台账'],
  ['runtime-project', '运行时的项目副本'],
];

export function planExternalProject(dir: string, taken: Set<string>): ProjectPlan | null {
  const loaded = readJson(path.join(dir, 'project.json'));
  if (!loaded?.timeline?.items || !loaded.metadata) return null;
  const project: Obj = loaded;
  const meta: Obj = project.metadata;
  const fps: Rate = { num: Math.round(meta.fps), den: 1 };
  const W: number = meta.width;
  const H: number = meta.height;
  const name = String(project.name || path.basename(dir));
  const report = newReport(dir, `external schema ${project.schemaVersion}`, 'external', name, fps);
  report.fps = { legacy: meta.fps, rate: fps };
  report.canvas = { width: W, height: H };
  const legacyItems = project.timeline.items as Obj[];
  const legacyTracks = [...(project.timeline.tracks as Obj[])];

  // ── Assets: media linked by its original path in the authorized directory; code packages linked by “package / version” directory, collecting only the versions the timeline uses ──
  const assets: AssetPlan[] = [];
  for (const mediaId of new Set(legacyItems.map((item) => item.mediaId).filter((id): id is string => typeof id === 'string'))) {
    const info = readJson(path.join(dir, 'runtime-media', mediaId, 'metadata.json'));
    if (!info?.relativePath) {
      report.warnings.push(`媒体 ${mediaId} 没有登记文件位置，没有导入`);
      continue;
    }
    assets.push({
      ref: `media:${mediaId}`,
      path: path.join(dir, info.relativePath),
      name: info.displayName ?? info.originalName,
      provenance: {
        origin: 'generated',
        source: { externalMediaId: mediaId, authority: info.authority ?? null, sourceRevision: info.sourceRevision ?? null },
      },
      hint: {
        kind: info.kind === 'video' || info.kind === 'image' ? info.kind : 'audio',
        durationUs: info.duration ? micros(info.duration) : undefined,
        width: info.probe?.width,
        height: info.probe?.height,
        hasAudio: info.kind !== 'image',
      },
    });
  }
  report.assets.planned = assets.length;
  // Code packages are stored by “package / version” directory; compositions are not imported, and no version is registered.
  const bundleRoot = path.join(dir, 'projects', String(project.id), 'assets', 'hyperframes');
  if (existsSync(bundleRoot)) {
    let revisions = 0;
    for (const bundleId of readdirSync(bundleRoot)) {
      const full = path.join(bundleRoot, bundleId);
      if (!statSync(full).isDirectory()) continue;
      for (const revision of readdirSync(full)) if (revision.startsWith('sha256-')) revisions++;
    }
    if (revisions > 0) report.notImported.push(`${revisions} 个代码包版本：合成没有预渲染替身，代码包不登记`);
  }
  for (const [rel, what] of SIDECARS) if (existsSync(path.join(dir, rel))) report.notImported.push(`${rel}：${what}`);

  return {
    key: `external-${project.id}`,
    name,
    dirName: uniqueName(dirNameOf(name), taken),
    fps,
    width: W,
    height: H,
    assets,
    report,
    build,
  };

  function build(known: Map<string, AssetInfo>): VideoContent {
    const documents: DocumentPlan[] = [];
    const tracks: TrackPlan[] = [];
    const items: ItemPlan[] = [];
    const frames = (n: number, base: number = fps.num): { ticks: string; timescale: number } => reduce(BigInt(Math.round(n)), BigInt(base));
    const assetRef = (info: AssetInfo): Json => ({ id: info.id, revision: info.revision });

    const drop = (label: string, note: string, by = 1): void => {
      count(report.dropped, label, by);
      report.warnings.push(note);
    };
    /** The positioning box in the subtitle style document keeps pixels (the `cuccut.boxed-caption-style` form). */
    const boxOf = (t: Obj | undefined): Json => ({
      x: t?.x ?? 0,
      y: t?.y ?? 0,
      width: t?.width ?? W,
      height: t?.height ?? H,
      anchor: [0.5, 0.5],
      rotation: t?.rotation ?? 0,
    });
    /** dB → linear multiplier, clamped to the new format's [0, 4]. */
    const volumeOf = (db: unknown, label: string): number => clampTo(report, label, linearOfDb(typeof db === 'number' ? db : 0), 0, 4);

    // Tracks: in the external project, a lower `order` is on top. In the new format, picture tracks further back are on the upper layer; audio tracks are arranged top to bottom in creation order.
    // Tracks holding only code compositions are not created: compositions are not imported, so the track would be empty.
    const usedTracks = legacyTracks.filter((track) => legacyItems.some((item) => item.trackId === track.id && item.type !== 'hyperframes'));
    const isSubtitle = (track: Obj): boolean =>
      legacyItems.filter((item) => item.trackId === track.id).every((item) => item.type === 'subtitle');
    const visual = usedTracks.filter((t) => t.kind !== 'audio' && !isSubtitle(t)).sort((a, b) => (b.order ?? 0) - (a.order ?? 0));
    const audio = usedTracks.filter((t) => t.kind === 'audio').sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
    for (const track of [...visual, ...audio]) {
      tracks.push({
        key: String(track.id),
        kind: track.kind === 'audio' ? 'audio' : 'visual',
        name: String(track.name ?? track.id),
        ...(track.visible === false ? { hidden: true } : {}),
        ...(track.muted === true ? { muted: true } : {}),
        ...(track.locked === true ? { locked: true } : {}),
      });
    }
    for (const track of usedTracks) {
      if (track.solo || (track.volume ?? 0) !== 0) drop('轨道的独奏 / 音量', `轨道 ${track.id} 的独奏或轨道音量新格式没有，没有带过来`);
    }

    const keyframes = new Map<string, Obj[]>();
    for (const group of (project.timeline.keyframes ?? []) as Obj[]) {
      for (const property of (group.properties ?? []) as Obj[]) {
        if (property.property === 'volume') keyframes.set(String(group.itemId), property.keyframes ?? []);
        else drop(`关键帧 ${property.property}`, `实例 ${group.itemId} 的 ${property.property} 关键帧（像素单位）没有带过来`);
      }
    }
    const transitionCount = (project.timeline.transitions ?? []).length;
    if (transitionCount > 0) drop('转场', `${transitionCount} 个转场没有带过来`, transitionCount);
    const markerCount = (project.timeline.markers ?? []).length;
    if (markerCount > 0) drop('标记', `${markerCount} 个标记没有带过来`, markerCount);

    const subtitles: Obj[] = [];
    for (const item of legacyItems) {
      const id = String(item.id);
      const sourceFps = item.sourceFps ?? fps.num;
      const timeMap = { kind: 'linear', sourceIn: frames(item.sourceStart ?? 0, sourceFps), rate: { ...rateOf(item.speed) } };
      const common = {
        ...(item.label ? { name: String(item.label).slice(0, 200) } : {}),
      };
      switch (item.type) {
        case 'hyperframes':
          // A new-format code composition needs a pre-rendered stand-in (same rule as `.ccut` code projects); external projects do not record code-package render results.
          drop(
            '没有预渲染替身的代码合成',
            `项目「${name}」的代码合成 ${id}（代码包 ${String(item.bundleId)}）没有预渲染替身：新格式的代码合成要有替身，没有导入，代码包也没有登记`,
          );
          break;
        case 'audio': {
          const info = known.get(`media:${item.mediaId}`);
          if (!info) {
            report.warnings.push(`音频 ${id} 的媒体 ${item.mediaId} 没有登记成素材，没有导入`);
            break;
          }
          // The source range cannot exceed the material: the external project's sourceEnd is rounded to frames, so it may exceed the file length by less than one frame.
          let playUs = (BigInt(item.durationInFrames) * 1_000_000n * BigInt(fps.den)) / BigInt(fps.num);
          let playDuration = frames(item.durationInFrames * fps.den, fps.num);
          if (info.durationUs != null) {
            const rate = rateOf(item.speed);
            const sourceInUs = (BigInt(Math.round(item.sourceStart ?? 0)) * 1_000_000n) / BigInt(sourceFps);
            const maxUs = ((info.durationUs - sourceInUs) * BigInt(rate.den)) / BigInt(rate.num);
            if (playUs > maxUs) {
              playUs = maxUs;
              playDuration = mediaTime(maxUs);
              report.time.clampedTails++;
            }
          }
          if (playUs <= 0n) {
            report.warnings.push(`音频 ${id} 的源区间在素材之外，没有导入`);
            break;
          }
          // In the external project, easing is recorded at the start of a segment (the keyframe on the left governs up to the next frame); the envelope's `ease` is recorded at the end point: the i-th point takes the easing of frame i−1,
          // and the easing of the last frame governs no segment.
          const volumeFrames = (keyframes.get(id) ?? []).slice(0, 256);
          const envelope = volumeFrames.map((k, i) => {
            const easing = i > 0 ? volumeFrames[i - 1]!.easing : undefined;
            const ease = typeof easing === 'string' && easing !== 'linear' && EASE_NAMES.includes(easing) ? easing : undefined;
            if (easing != null && easing !== 'linear' && !ease)
              drop('关键帧缓动', `音频 ${id} 的音量关键帧缓动 ${String(easing)} 不在缓动表里：按线性`);
            return { at: frames(k.frame * fps.den, fps.num), volume: volumeOf(k.value, '音量关键帧'), ...(ease ? { ease } : {}) };
          });
          if ((keyframes.get(id) ?? []).length > 256)
            drop('关键帧（每个属性最多 256 个）', `音频 ${id} 的音量关键帧超过 256 个：只带前 256 个`);
          const fade = (seconds: unknown, label: string): Obj =>
            typeof seconds === 'number' && seconds > 0 ? { [label]: mediaTime(micros(clampTo(report, label, seconds, 0, 5))) } : {};
          items.push({
            track: String(item.trackId),
            sourceId: id,
            item: {
              type: 'audio',
              assetRef: assetRef(info),
              fromFrame: item.from,
              subframeOffset: { ticks: '0', timescale: 1 },
              playDuration,
              timeMap,
              mix: {
                // When there are volume keyframes, the keyframe value is the absolute volume: the envelope replaces the static volume.
                volume: envelope.length > 0 ? 1 : volumeOf(item.volume, 'volume'),
                ...fade(item.audioFadeIn, 'fadeIn'),
                ...fade(item.audioFadeOut, 'fadeOut'),
                ...(envelope.length > 0 ? { envelope } : {}),
              },
              ...common,
              extensions: { 'cuccut.import': { sourceId: id, mediaId: item.mediaId } },
            },
          });
          break;
        }
        case 'subtitle':
          subtitles.push(item);
          break;
        default:
          drop(`实例类型 ${item.type}`, `实例 ${id} 的类型 ${item.type} 新格式没有对应，没有导入`);
      }
    }

    // ── Subtitles: the external project has one instance per sentence, each carrying its own style; here one subtitle document + one style document are composed ──
    if (subtitles.length > 0) {
      subtitles.sort((a, b) => a.from - b.from);
      const STYLE_KEYS = [
        'color',
        'x',
        'y',
        'scale',
        'rotation',
        'opacity',
        'fontSize',
        'fontFamily',
        'fontWeight',
        'fontStyle',
        'underline',
        'allCaps',
        'letterSpacing',
        'backgroundColor',
        'backgroundRadius',
        'textAlign',
        'verticalAlign',
        'lineHeight',
        'textPadding',
        'textShadow',
        'transform',
      ];
      const styleOf = (item: Obj): Obj =>
        Object.fromEntries(STYLE_KEYS.filter((key) => item[key] !== undefined).map((key) => [key, item[key]]));
      const shared = styleOf(subtitles[0]);
      const sharedText = JSON.stringify(shared);
      // Subtitle animation presets of the external project are not carried over: its preset names do not say how per-word animation is drawn, and the output has no per-word effect (imported without animation).
      const presets = new Map<string, number>();
      for (const item of subtitles) {
        if (item.animationPresetId != null)
          presets.set(String(item.animationPresetId), (presets.get(String(item.animationPresetId)) ?? 0) + 1);
      }
      const usPerFrame = (frame: number): number => Number((BigInt(frame) * 1_000_000n * BigInt(fps.den)) / BigInt(fps.num));
      const cues = subtitles.flatMap((item) => {
        const own = JSON.stringify(styleOf(item)) === sharedText ? null : styleOf(item);
        if (own) count(report.unmapped, '单句字幕自己的样式（留在 cue 的扩展里）');
        const startUs = usPerFrame(item.from);
        const endUs = usPerFrame(item.from + item.durationInFrames);
        return ((item.cues ?? []) as Obj[]).map((cue) => ({
          id: String(cue.id),
          // In-sentence times are seconds relative to the instance start; the instance's frame range is authoritative, and the sentence end is kept within the instance.
          start: startUs + Number(micros(cue.startSeconds ?? 0)),
          end: Math.min(endUs, startUs + Number(micros(cue.endSeconds ?? 0))),
          text: String(cue.text ?? ''),
          extensions: { 'cuccut.import': { sourceItemId: item.id, ...(own ? { style: own } : {}) } },
        }));
      });
      const source = subtitles[0].source ?? null;
      documents.push({
        ref: 'caption',
        kind: 'caption',
        name: String(source?.fileName ?? '字幕'),
        body: { schema: 'cuccut.caption/1', clock: 'sequence', timescale: 1_000_000, cues, source } as Json,
        summary: { cueCount: cues.length },
      });
      documents.push({
        ref: 'caption-style',
        kind: 'caption-style',
        name: '字幕样式',
        body: {
          schema: `cuccut.boxed-caption-style/${project.schemaVersion}`,
          canvas: { width: W, height: H },
          box: boxOf(shared.transform),
          style: shared,
        } as Json,
      });
      for (const [preset, n] of presets) {
        drop(
          '外部项目的字幕动画预设（成片里没有逐词效果）',
          `外部项目的字幕动画预设 ${preset}（${n} 句）没有带过来：成片里没有逐词效果，按不动画导入`,
          n,
        );
      }
      const first = subtitles[0].from;
      const last = Math.max(...subtitles.map((item) => item.from + item.durationInFrames));
      tracks.push({
        key: 'subtitle',
        kind: 'subtitle',
        name: String(legacyTracks.find((t) => t.id === subtitles[0].trackId)?.name ?? '字幕'),
      });
      items.push({
        track: 'subtitle',
        sourceId: 'caption',
        item: {
          type: 'caption',
          span: { fromFrame: first, durationFrames: last - first },
          extensions: { 'cuccut.import': { sourceId: 'caption', itemCount: subtitles.length } },
        },
        document: 'caption',
        styleDocument: 'caption-style',
      });
    }

    // ── Export records ──
    const exportsDir = path.join(dir, 'exports');
    const files: string[] = [];
    if (existsSync(exportsDir)) {
      for (const entry of readdirSync(exportsDir, { withFileTypes: true, recursive: true })) {
        if (entry.isFile() && !entry.name.startsWith('.')) files.push(path.join(entry.parentPath, entry.name));
      }
    }
    if (files.length > 0) {
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
            };
          }),
        } as Json,
        summary: { fileCount: files.length },
      });
    }
    return { documents, tracks, items };
  }
}
