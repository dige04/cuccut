import {
  refOf,
  sequenceDisplayName,
  type AssetRevision,
  type CompositionItem,
  type Id,
  type ImageItem,
  type Localized,
  type MediaTime,
  type MessageRef,
  type Rate,
  type SequenceItem,
  type Track,
  type VersionRef,
  type VideoItem,
  type VideoSnapshot,
} from '@cuccut/protocol';
import { RcExport } from '@cuccut/protocol/messages/runtime-core';

/**
 * Project export (architecture design §9.13): writes a sequence as Final Cut Pro 7 XML (xmeml v5), which Premiere Pro and DaVinci Resolve can import. It is a one-way, lossy exchange, not a render:
 *
 * - Written: the in/out points of video, image, and audio instances and their positions on the sequence, each on its own track (video tracks by `order`, bottom to top). The embedded sound of a video instance goes on a separate audio track. A composition with a pre-render stand-in is written as the stand-in's video. Disabled instances are written with `enabled` false, and muted tracks and instances likewise.
 * - What cannot be expressed is recorded item by item in the report (task warnings) rather than silently dropped: text, graphics, captions, generated elements (stickers, waveforms, progress bars, freehand drawing, placeholder boxes, confetti, whiteboard freehand), compositions without a stand-in, transitions, effects (`fx`), cropping, masks, rounded corners, element animation and keyframes, placements that don't fill the canvas (picture-in-picture, rotation, mirroring, tiling), opacity, volume and fades, speed changes and freeze frames, sub-frame offsets of audio instances, and assets whose files can't be read.
 * - Assets are written by reference: as absolute local paths (`file://` URLs). This is an exchange file for this machine or for machines with the same paths, not a portable package.
 */

export interface ProjectAsset {
  path?: string;
  missing?: { reason: string };
}

export interface ProjectOmission {
  itemId?: Id;
  transitionId?: Id;
  /** Text in the language current at emission. `whatRef` is its reference (the task warning's `detailRef`). */
  what: string;
  whatRef?: MessageRef;
}

function omission(what: Localized, ids: { itemId?: Id; transitionId?: Id } = {}): ProjectOmission {
  return { ...ids, what: what.text, whatRef: refOf(what) };
}

export interface ProjectRender {
  xml: string;
  clips: number;
  omitted: ProjectOmission[];
  durationSec: number;
}

function itemKindLabel(type: SequenceItem['type']): Localized {
  switch (type) {
    case 'video':
      return RcExport.itemKindVideo();
    case 'image':
      return RcExport.itemKindImage();
    case 'audio':
      return RcExport.itemKindAudio();
    case 'text':
      return RcExport.itemKindText();
    case 'shape':
      return RcExport.itemKindShape();
    case 'composition':
      return RcExport.itemKindComposition();
    case 'caption':
      return RcExport.itemKindCaption();
    case 'sticker':
      return RcExport.itemKindSticker();
    case 'visualizer':
      return RcExport.itemKindVisualizer();
    case 'progress':
      return RcExport.itemKindProgress();
    case 'draw':
      return RcExport.itemKindDraw();
    case 'placeholder':
      return RcExport.itemKindPlaceholder();
    case 'confetti':
      return RcExport.itemKindConfetti();
    case 'whiteboard':
      return RcExport.itemKindWhiteboard();
  }
}

/** xmeml recognizes only these: video, images, audio, and compositions with a stand-in. All other kinds are skipped entirely and reported. */
const PROJECT_KINDS = new Set<SequenceItem['type']>(['video', 'image', 'audio', 'composition']);

function escapeXml(text: string): string {
  return text.replace(/[<>&"']/g, (c) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;', "'": '&apos;' })[c]!);
}

function seconds(time: MediaTime): number {
  return Number(time.ticks) / time.timescale;
}

/** xmeml frame rate: an integer timebase plus the NTSC flag (x000/1001). A frame rate that cannot be expressed is written as the nearest integer and reported. */
export function xmemlRate(fps: Rate): { timebase: number; ntsc: boolean; exact: boolean } {
  if (fps.den === 1001 && fps.num % 1000 === 0) return { timebase: fps.num / 1000, ntsc: true, exact: true };
  const value = fps.num / fps.den;
  return { timebase: Math.round(value), ntsc: false, exact: Number.isInteger(value) };
}

function rateXml(rate: { timebase: number; ntsc: boolean }): string {
  return `<rate><timebase>${rate.timebase}</timebase><ntsc>${rate.ntsc ? 'TRUE' : 'FALSE'}</ntsc></rate>`;
}

/** The `file://localhost/...` URL of a local path, with each segment URL-encoded. */
export function pathUrl(file: string): string {
  return `file://localhost${file
    .split('/')
    .map((part) => encodeURIComponent(part))
    .join('/')}`;
}

/**
 * Whether an instance fills the canvas and is neither rotated nor flipped (consistent with how it is rendered). For video and images, this depends on `mode`: when filling, the position, width, and scale in `place` don't apply, and tiled images don't count. Compositions have no `mode`, so they fill when `place` gives no position and width.
 */
function isFullFrame(item: VideoItem | ImageItem | CompositionItem): boolean {
  const place = item.place;
  const fullscreen =
    item.type === 'composition'
      ? place.x === undefined && place.y === undefined && place.w === undefined
      : item.mode === 'fullscreen' && !(item.type === 'image' && item.tile?.on);
  return fullscreen && !place.rot && !place.flipX && !place.flipY;
}

function startOf(item: SequenceItem): number {
  return 'span' in item ? item.span.fromFrame : item.fromFrame;
}

interface Clip {
  itemId: Id;
  name: string;
  enabled: boolean;
  start: number;
  end: number;
  inFrame: number;
  outFrame: number;
  fileKey: string;
}

/** Writes the sequence as xmeml. `assets` gives the locations of the asset versions (`id@revision`) at this moment. */
export function renderXmeml(video: VideoSnapshot, sequenceId: Id, assets: Map<string, ProjectAsset>): ProjectRender {
  const sequence = video.sequences[sequenceId];
  if (!sequence) throw new Error(RcExport.sequenceNotFound({ sequenceId }).text);
  const fps = sequence.fps;
  const fpsValue = fps.num / fps.den;
  const rate = xmemlRate(fps);
  const omitted: ProjectOmission[] = [];
  if (!rate.exact) omitted.push(omission(RcExport.projectFpsInexact({ fps: `${fps.num}/${fps.den}`, timebase: rate.timebase })));
  const canvas = sequence.canvas;
  const frames = (s: number) => Math.round(s * fpsValue);

  const files = new Map<string, { id: string; name: string; revision: AssetRevision; path?: string; frames: number }>();
  const fileFor = (ref: VersionRef, itemId: Id): string | null => {
    const key = `${ref.id}@${ref.revision}`;
    if (files.has(key)) return key;
    const record = video.assets[ref.id];
    const revision = record?.revisions[ref.revision];
    if (!record || !revision) return null;
    const location = assets.get(key);
    if (!location?.path)
      omitted.push(
        omission(RcExport.projectAssetOffline({ name: record.name, reason: location?.missing?.reason ?? 'missing' }), { itemId }),
      );
    files.set(key, {
      id: `file-${files.size + 1}`,
      name: record.name,
      revision,
      ...(location?.path ? { path: location.path } : {}),
      frames: revision.duration ? frames(seconds(revision.duration)) : 0,
    });
    return key;
  };

  const tracks = [...sequence.tracks].sort((a, b) => a.order - b.order);
  const animated = new Set(sequence.animationBindings.filter((b) => b.keyframes.length > 0).map((b) => b.targetId));
  const videoTracks: Array<{ track: Track; clips: Clip[] }> = [];
  const audioTracks: Array<{ track: Track | null; name: string; clips: Clip[] }> = [];
  const embedded: Clip[] = [];
  let durationFrames = 0;

  for (const track of tracks) {
    // Sorted by start on the sequence (some software requires the clips in a track to be in order).
    const items = sequence.items.filter((i) => i.trackId === track.id).sort((a, b) => startOf(a) - startOf(b));
    const clips: Clip[] = [];
    for (const item of items) {
      const kind = itemKindLabel(item.type);
      const omit = (reason: Localized) =>
        omitted.push(
          omission(RcExport.projectItemOmitted({ kind, itemId: item.id, name: item.name || null, reason }), { itemId: item.id }),
        );
      if (!PROJECT_KINDS.has(item.type)) {
        omit(item.type === 'caption' ? RcExport.omitCaption() : RcExport.omitUnsupportedKind());
        continue;
      }
      if (item.type === 'composition' && !item.prerender) {
        omit(RcExport.omitNoPrerender());
        continue;
      }
      if (item.type === 'audio') {
        const key = fileFor(item.assetRef, item.id);
        if (!key) {
          omit(RcExport.omitAssetMissing());
          continue;
        }
        if (item.timeMap.kind !== 'linear') {
          omit(RcExport.omitFreezeFrame());
          continue;
        }
        if (item.timeMap.rate.num !== item.timeMap.rate.den) omit(RcExport.omitSpeed());
        if (Number(item.subframeOffset.ticks) !== 0) omit(RcExport.omitSubframe());
        if (item.mix.volume !== 1 || item.mix.fadeIn || item.mix.fadeOut || item.mix.envelope?.length)
          omit(RcExport.omitAudioMix());
        const length = frames(seconds(item.playDuration));
        const inFrame = frames(seconds(item.timeMap.sourceIn));
        clips.push({
          itemId: item.id,
          name: item.name ?? video.assets[item.assetRef.id]!.name,
          enabled: item.enabled && !item.mix.muted,
          start: item.fromFrame,
          end: item.fromFrame + length,
          inFrame,
          outFrame: inFrame + length,
          fileKey: key,
        });
        durationFrames = Math.max(durationFrames, item.fromFrame + length);
        continue;
      }
      if (item.type !== 'video' && item.type !== 'image' && item.type !== 'composition') continue;
      // Video, images, and compositions with a stand-in.
      const ref = item.type === 'composition' ? item.prerender! : item.assetRef;
      const key = fileFor(ref, item.id);
      if (!key) {
        omit(RcExport.omitAssetMissing());
        continue;
      }
      const place = item.place;
      if (!isFullFrame(item)) omit(RcExport.omitPlacement());
      if (place.opacity !== undefined && place.opacity !== 1) omit(RcExport.omitOpacity());
      if (place.radius || place.cornerRadii) omit(RcExport.omitCornerRadius());
      if (item.fx && Object.keys(item.fx).length > 0) omit(RcExport.omitEffects());
      if (item.mask) omit(RcExport.omitMask());
      if (item.animate && Object.keys(item.animate).length > 0) omit(RcExport.omitAnimation());
      if (animated.has(item.id)) omit(RcExport.omitKeyframes());
      if (item.type !== 'composition' && item.crop) omit(RcExport.omitCrop());
      let inFrame = 0;
      if (item.type === 'video' || item.type === 'composition') {
        if (item.timeMap.kind !== 'linear') {
          omit(RcExport.omitFreezeFrame());
          continue;
        }
        if (item.timeMap.rate.num !== item.timeMap.rate.den) omit(RcExport.omitSpeed());
        inFrame = frames(seconds(item.timeMap.sourceIn));
      }
      const clip: Clip = {
        itemId: item.id,
        name: item.name ?? video.assets[ref.id]!.name,
        enabled: item.enabled && track.visible,
        start: item.span.fromFrame,
        end: item.span.fromFrame + item.span.durationFrames,
        inFrame,
        outFrame: inFrame + item.span.durationFrames,
        fileKey: key,
      };
      clips.push(clip);
      durationFrames = Math.max(durationFrames, clip.end);
      const audio = item.type === 'video' ? item.embeddedAudio : item.type === 'composition' ? item.audio : undefined;
      if (audio?.enabled && files.get(key)!.revision.audio) {
        if (audio.volume !== 1 || audio.fadeIn || audio.fadeOut || audio.envelope?.length)
          omit(RcExport.omitEmbeddedAudioMix());
        embedded.push({ ...clip, itemId: `${item.id}-audio`, enabled: clip.enabled && !track.muted });
      }
    }
    if (track.kind === 'visual') videoTracks.push({ track, clips });
    else if (track.kind === 'audio')
      audioTracks.push({ track, name: track.name ?? 'A', clips: clips.map((c) => ({ ...c, enabled: c.enabled && !track.muted })) });
  }
  if (embedded.length > 0) {
    // The embedded sound goes on its own audio track: several video instances may sound at the same time, so each takes a track that doesn't overlap.
    const lanes: Clip[][] = [];
    for (const clip of [...embedded].sort((a, b) => a.start - b.start)) {
      const lane = lanes.find((l) => l.at(-1)!.end <= clip.start);
      if (lane) lane.push(clip);
      else lanes.push([clip]);
    }
    lanes.forEach((clips, i) => audioTracks.unshift({ track: null, name: RcExport.embeddedAudioTrack({ n: i + 1 }).text, clips }));
  }
  for (const transition of sequence.transitions) {
    omitted.push(omission(RcExport.projectTransitionOmitted({ kind: transition.kind }), { transitionId: transition.id }));
  }

  let clipCounter = 0;
  const fileWritten = new Set<string>();
  const fileXml = (key: string, kind: 'video' | 'audio'): string => {
    const f = files.get(key)!;
    if (fileWritten.has(key)) return `<file id="${f.id}"/>`;
    fileWritten.add(key);
    const media = [
      f.revision.video
        ? `<video><samplecharacteristics><width>${f.revision.video.displayWidth}</width><height>${f.revision.video.displayHeight}</height></samplecharacteristics></video>`
        : '',
      f.revision.audio
        ? `<audio><samplecharacteristics><samplerate>${f.revision.audio.sampleRate}</samplerate></samplecharacteristics><channelcount>${f.revision.audio.channels}</channelcount></audio>`
        : '',
    ].join('');
    return [
      `<file id="${f.id}">`,
      `<name>${escapeXml(f.name)}</name>`,
      f.path ? `<pathurl>${escapeXml(pathUrl(f.path))}</pathurl>` : '',
      rateXml(rate),
      f.frames ? `<duration>${f.frames}</duration>` : '',
      `<media>${media || (kind === 'video' ? '<video/>' : '<audio/>')}</media>`,
      `</file>`,
    ].join('');
  };
  const clipXml = (clip: Clip, kind: 'video' | 'audio'): string => {
    clipCounter += 1;
    const f = files.get(clip.fileKey)!;
    return [
      `<clipitem id="clipitem-${clipCounter}">`,
      `<name>${escapeXml(clip.name)}</name>`,
      `<enabled>${clip.enabled ? 'TRUE' : 'FALSE'}</enabled>`,
      `<duration>${Math.max(f.frames, clip.outFrame)}</duration>`,
      rateXml(rate),
      `<start>${clip.start}</start><end>${clip.end}</end>`,
      `<in>${clip.inFrame}</in><out>${clip.outFrame}</out>`,
      fileXml(clip.fileKey, kind),
      kind === 'audio' ? '<sourcetrack><mediatype>audio</mediatype><trackindex>1</trackindex></sourcetrack>' : '',
      `</clipitem>`,
    ].join('');
  };
  const videoXml = videoTracks
    .map(
      ({ track, clips }) =>
        `<track><enabled>${track.visible ? 'TRUE' : 'FALSE'}</enabled>${clips.map((c) => clipXml(c, 'video')).join('')}</track>`,
    )
    .join('');
  const audioXml = audioTracks.map(({ clips }) => `<track>${clips.map((c) => clipXml(c, 'audio')).join('')}</track>`).join('');
  const clips = clipCounter;
  const xml = [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<!DOCTYPE xmeml>',
    '<xmeml version="5">',
    `<sequence id="sequence-1">`,
    `<name>${escapeXml(`${video.name} · ${sequenceDisplayName(sequence)}`)}</name>`,
    `<duration>${durationFrames}</duration>`,
    rateXml(rate),
    '<media>',
    `<video><format><samplecharacteristics>${rateXml(rate)}<width>${canvas.width}</width><height>${canvas.height}</height><pixelaspectratio>square</pixelaspectratio></samplecharacteristics></format>${videoXml}</video>`,
    `<audio>${audioXml}</audio>`,
    '</media>',
    '</sequence>',
    '</xmeml>',
    '',
  ].join('\n');
  return { xml, clips, omitted, durationSec: durationFrames / fpsValue };
}
