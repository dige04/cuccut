import { describe, expect, it } from 'vitest';
import type { AssetRecord, AssetRevision, Place } from '@cuccut/protocol';
import { assetLibrarySource } from './library-brand.ts';
import type { PlacedItem } from './stage-pose.ts';
import {
  BAR,
  OFF_REASON,
  TOOL_LABEL,
  barKindOf,
  brandTarget,
  captionCase,
  captionToolbar,
  itemAsset,
  nextCaptionCase,
  toolbarFor,
  toolbarPlacement,
  type MenuGroup,
  type Tool,
  type ToolbarSpec,
} from './stage-toolbar.ts';

const place: Place = { x: 50, y: 50, w: 10 };
const linear = { kind: 'linear', sourceIn: { ticks: '0', timescale: 1 }, rate: { num: 1, den: 1 } };
const text = (style: unknown = { fontSize: 40 }) => ({ id: 't', type: 'text', text: '标题', place, style }) as unknown as PlacedItem;
const video = (timeMap: unknown = linear) =>
  ({ id: 'v', type: 'video', mode: 'pip', place, assetRef: { id: 'asset_video', revision: 'r1' }, timeMap, embeddedAudio: { enabled: true, volume: 1 } }) as unknown as PlacedItem;
const image = () => ({ id: 'i', type: 'image', mode: 'pip', place }) as unknown as PlacedItem;
const shape = (value: unknown = { shape: 'rect', fill: '#3B63FB' }) =>
  ({ id: 's', type: 'shape', place, shape: value }) as unknown as PlacedItem;
const composition = (source: unknown) => ({ id: 'c', type: 'composition', place, source, timeMap: linear }) as unknown as PlacedItem;
/** Element instances (stickers, progress bars, waveforms, ...) and text with a timer readout. */
const element = (type: string, more: Record<string, unknown> = {}) => ({ id: 'e', type, place, ...more }) as unknown as PlacedItem;
const sticker = () => element('sticker', { sticker: { source: 'template', templateId: 'heart' } });
const counter = () => element('text', { counter: { mode: 'countdown' }, style: {} });
/** Assets drawn by the clip: by default they are collected into the video folder (they cannot be saved to the brand library). */
const media = (kind: AssetRecord['kind'], patch: Partial<AssetRevision> = {}): AssetRecord => ({
  id: `asset_${kind}`,
  kind,
  name: '片头',
  currentRevision: 'r1',
  revisions: {
    r1: { revision: 'r1', contentHash: 'sha256:00', byteLength: 10, mediaType: 'image/png', storage: { mode: 'managed' }, provenance: { origin: 'import' }, ...patch },
  },
});
const linkedVideo = () => media('video', { storage: { mode: 'linked', locator: { path: '/Volumes/素材/片头.mp4' }, frozen: false } });

const ids = (groups: Tool[][]) => groups.map((g) => g.map((t) => t.id));
const menuIds = (more: MenuGroup[] | null) =>
  (more ?? []).map((g) => (g.kind === 'row' ? g.clusters.map((c) => c.map((t) => t.id)) : g.tools.map((t) => t.id)));
const allTools = (spec: ToolbarSpec): Tool[] => [...spec.visible.flat(), ...(spec.more ?? []).flatMap((g) => (g.kind === 'row' ? g.clusters.flat() : g.tools))];
const find = (spec: ToolbarSpec, id: string) => allTools(spec).find((t) => t.id === id);

const SAMPLES = [
  text(),
  video(),
  image(),
  shape(),
  sticker(),
  element('sticker', { assetRef: { id: 'lottie', revision: '1' }, sticker: { source: 'asset' } }),
  element('progress', { progress: { style: 'rounded' } }),
  element('visualizer', { visualizer: { style: 'bars' } }),
  counter(),
  element('confetti', { confetti: {} }),
  element('whiteboard', { whiteboard: {} }),
  composition({ kind: 'bundle', assetRef: { id: 'a', revision: 1 } }),
];

describe('grouping by type', () => {
  it('text / video / image / shape / sticker / progress / waveform / timer / confetti / whiteboard each have their own path; a code-package composition falls back to "other"', () => {
    expect(SAMPLES.map(barKindOf)).toEqual([
      'text',
      'video',
      'image',
      'shape',
      'sticker',
      'sticker',
      'progress',
      'wave',
      'counter',
      'confetti',
      'whiteboard',
      'other',
    ]);
  });
});

describe('config table laid out as in the prototype', () => {
  it('text: the bar is "color font size │ style animation", menus follow the prototype item by item', () => {
    const spec = toolbarFor(text());
    expect(ids(spec.visible)).toEqual([
      ['color', 'font', 'size'],
      ['text-styles', 'animation'],
    ]);
    expect(menuIds(spec.more)).toEqual([
      [
        ['bold', 'italic'],
        ['align-left', 'align-center', 'align-right'],
      ],
      ['line-height', 'letter-spacing'],
      ['opacity'],
      ['copy', 'arrange', 'save-to-brand-kit'],
      ['properties'],
      ['adjust-timing', 'disable', 'delete'],
    ]);
  });

  it('video: the bar has transition, volume, speed; the menu\'s last section runs from adjust time to delete', () => {
    const spec = toolbarFor(video());
    expect(ids(spec.visible)).toEqual([
      ['animation', 'transitions'],
      ['volume', 'speed'],
    ]);
    expect(menuIds(spec.more).at(-1)).toEqual(['adjust-timing', 'crop-video', 'replace-video', 'detach-audio', 'save-to-brand-kit', 'delete']);
  });

  it('flip and fit to canvas are in the first section of the image, video, shape and sticker menus: one row, two clusters', () => {
    for (const item of [image(), video(), shape(), sticker()]) {
      expect(menuIds(toolbarFor(item).more)[0]).toEqual([
        ['flip-vertical', 'flip-horizontal'],
        ['fit-canvas', 'fill-canvas'],
      ]);
    }
  });

  it('every kind\'s menu ends its last section with delete', () => {
    for (const item of SAMPLES.filter((i) => barKindOf(i) !== 'other')) {
      expect(menuIds(toolbarFor(item).more).at(-1)?.at(-1)).toBe('delete');
    }
  });

  it('"Properties" appears only in the menus for text, shape, sticker, timer, confetti and whiteboard', () => {
    const withProps = Object.entries(BAR)
      .filter(([, layout]) => (layout.more ?? []).some((g) => g.flat().includes('properties')))
      .map(([kind]) => kind)
      .sort();
    expect(withProps).toEqual(['confetti', 'counter', 'shape', 'sticker', 'text', 'whiteboard']);
  });

  it('no bar has "Save to brand library"', () => {
    for (const layout of Object.values(BAR)) expect(layout.visible.flat()).not.toContain('save-to-brand-kit');
  });

  it('confetti and whiteboard: the bar has one "Animation" button; the menu is opacity, duplicate / layer, properties, duration / disable / delete', () => {
    for (const item of [element('confetti', { confetti: {} }), element('whiteboard', { whiteboard: {} })]) {
      const spec = toolbarFor(item);
      expect(ids(spec.visible)).toEqual([['animation']]);
      expect(menuIds(spec.more)).toEqual([['opacity'], ['copy', 'arrange'], ['properties'], ['adjust-timing', 'disable', 'delete']]);
    }
  });

  it('an unrecognized composition has only one "Properties" button; the menu is the generic opacity, duplicate / layer, duration / disable / delete', () => {
    const spec = toolbarFor(composition({ kind: 'bundle', assetRef: { id: 'a', revision: 1 } }));
    expect(ids(spec.visible)).toEqual([['properties']]);
    expect(menuIds(spec.more)).toEqual([['opacity'], ['copy', 'arrange'], ['adjust-timing', 'disable', 'delete']]);
    expect(spec.visible[0]![0]!.action).toEqual({ kind: 'jump', section: null });
  });
});

describe('what each cell does', () => {
  it('every cell has a display name; each unusable cell states its reason', () => {
    for (const item of SAMPLES) {
      for (const tool of allTools(toolbarFor(item))) {
        expect(tool.label).toBe(TOOL_LABEL[tool.id]);
        expect(tool.label.length).toBeGreaterThan(0);
        if (tool.action.kind === 'off') expect(tool.action.reason.length).toBeGreaterThan(0);
      }
    }
  });

  it('cells not yet wired are unusable: animation, rounded corners (the preview cannot draw them), filters, smart crop', () => {
    const spec = toolbarFor(video());
    for (const id of ['animation', 'round-corners', 'filters', 'crop-video']) {
      expect(find(spec, id)?.action.kind, id).toBe('off');
    }
  });

  it('replace video / replace image is a command (opens the replace dialog, replaces only this clip)', () => {
    expect(find(toolbarFor(video()), 'replace-video')?.action).toEqual({ kind: 'command' });
    expect(find(toolbarFor(image()), 'replace-image')?.action).toEqual({ kind: 'command' });
  });

  it('separate audio: a command when the media has an audio track and the video\'s own sound is on; otherwise says there is no sound', () => {
    const withSound = media('video', { audio: { sampleRate: 48000, channels: 2 } });
    const clip = video();
    expect(find(toolbarFor(clip, { asset: withSound }), 'detach-audio')?.action).toEqual({ kind: 'command' });
    expect(find(toolbarFor(clip, { asset: media('video') }), 'detach-audio')?.action).toEqual({ kind: 'off', reason: OFF_REASON.sound });
    const muted = { ...clip, embeddedAudio: { enabled: false, volume: 1 } } as PlacedItem;
    expect(find(toolbarFor(muted, { asset: withSound }), 'detach-audio')?.action).toEqual({ kind: 'off', reason: OFF_REASON.sound });
  });

  // The toolbars already shipped in CucCut v2 (MEDIA_MORE / PLAIN_MORE in stage-toolbar.logic.ts): every category except video has opacity and “Hide” in its menu.
  it('compared with v2: every kind except video has opacity (drill-down) and disable clip (command, placed before delete) in its menu', () => {
    for (const item of SAMPLES) {
      const spec = toolbarFor(item);
      const kind = barKindOf(item);
      const last = menuIds(spec.more).at(-1) as string[];
      if (kind === 'video') {
        expect(find(spec, 'disable'), kind).toBeUndefined();
        continue;
      }
      expect(find(spec, 'opacity')?.action, kind).toEqual({ kind: 'sub' });
      expect(find(spec, 'disable')?.action, kind).toEqual({ kind: 'command' });
      expect(last.slice(-2), kind).toEqual(['disable', 'delete']);
    }
  });

  it('"Layer" drills down one level in the menu of every kind of visual element (four directions)', () => {
    for (const item of SAMPLES) {
      const spec = toolbarFor(item);
      expect(find(spec, 'arrange')?.action, item.type).toEqual({ kind: 'sub' });
    }
  });

  it('text: color, font, size open a popover; B / I / align are toggles; line height and letter spacing drill down; style jumps to the "Style" section of the properties page', () => {
    const spec = toolbarFor(text());
    expect(find(spec, 'color')?.action).toEqual({ kind: 'pop' });
    expect(find(spec, 'font')?.action).toEqual({ kind: 'pop' });
    expect(find(spec, 'bold')?.action).toEqual({ kind: 'toggle' });
    expect(find(spec, 'line-height')?.action).toEqual({ kind: 'sub' });
    expect(find(spec, 'text-styles')?.action).toEqual({ kind: 'jump', section: 'style' });
    expect(find(spec, 'copy')?.action).toEqual({ kind: 'command' });
    expect(find(spec, 'delete')?.action).toEqual({ kind: 'command' });
  });

  it('text with an unrecognized style: the cells that change text are unusable, naming the style', () => {
    const spec = toolbarFor(text({ schema: 'cuccut.text-style/v2' }));
    for (const id of ['color', 'font', 'size', 'bold', 'line-height', 'text-styles']) {
      const action = find(spec, id)?.action;
      expect(action?.kind, id).toBe('off');
      expect(action?.kind === 'off' && action.reason).toContain('cuccut.text-style/v2');
    }
  });

  it('video: transition and effects jump to the matching section of the properties page; speed is unusable when the time map is not constant-speed', () => {
    const spec = toolbarFor(video());
    expect(find(spec, 'transitions')?.action).toEqual({ kind: 'jump', section: 'transition' });
    expect(find(spec, 'effects')?.action).toEqual({ kind: 'jump', section: 'effects' });
    expect(find(spec, 'speed')?.action).toEqual({ kind: 'pop' });
    expect(find(spec, 'volume')?.action).toEqual({ kind: 'pop' });
    expect(find(toolbarFor(video({ kind: 'hold', sourceAt: { ticks: '0', timescale: 1 } })), 'speed')?.action.kind).toBe('off');
  });

  it('element parameter cells (fill color, style, mode, timer color and font) jump to the top of the properties page', () => {
    expect(find(toolbarFor(sticker()), 'fill-list')?.action).toEqual({ kind: 'jump', section: null });
    expect(find(toolbarFor(element('progress', { progress: { style: 'rounded' } })), 'progress-picker')?.action).toEqual({
      kind: 'jump',
      section: null,
    });
    const spec = toolbarFor(counter());
    expect(find(spec, 'counter-mode')?.action).toEqual({ kind: 'jump', section: null });
    expect(find(spec, 'color')?.action).toEqual({ kind: 'jump', section: null });
    expect(find(spec, 'bold')?.action).toEqual({ kind: 'jump', section: null });
  });

  it('save to brand library: text says the brand library has no text style section yet; video and image can be saved only when the original media file is reachable', () => {
    expect(find(toolbarFor(text()), 'save-to-brand-kit')?.action).toEqual({ kind: 'off', reason: OFF_REASON.brandText });
    expect(find(toolbarFor(video()), 'save-to-brand-kit')?.action).toEqual({ kind: 'off', reason: OFF_REASON.brand });
    expect(find(toolbarFor(video(), { asset: media('audio') }), 'save-to-brand-kit')?.action).toEqual({ kind: 'off', reason: OFF_REASON.brand });
    expect(find(toolbarFor(video(), { asset: linkedVideo() }), 'save-to-brand-kit')?.action).toEqual({ kind: 'command' });
    const generated = media('image', { provenance: { origin: 'generated', source: { artifactId: 'sha256:ab' } } });
    expect(find(toolbarFor(image(), { asset: generated }), 'save-to-brand-kit')?.action).toEqual({ kind: 'command' });
    const embedded = media('image');
    const found = assetLibrarySource(embedded);
    expect(find(toolbarFor(image(), { asset: embedded }), 'save-to-brand-kit')?.action).toEqual({ kind: 'off', reason: 'reason' in found ? found.reason : '' });
  });

  it('in the browser the brand library cannot be saved to (the web service does not allow library.*): media clips and subtitles explain where they can be used; text still says there is no text style section', () => {
    const web = { kind: 'off', reason: OFF_REASON.brandWeb };
    expect(find(toolbarFor(video(), { asset: linkedVideo(), web: true }), 'save-to-brand-kit')?.action).toEqual(web);
    expect(find(captionToolbar({ paired: false, styled: true, web: true }), 'save-to-brand-kit')?.action).toEqual(web);
    expect(find(toolbarFor(text(), { web: true }), 'save-to-brand-kit')?.action).toEqual({ kind: 'off', reason: OFF_REASON.brandText });
  });

  it('what gets saved on press is the section and source judged on the bar', () => {
    const asset = linkedVideo();
    const item = { ...video(), assetRef: { id: asset.id, revision: 'r1' } } as unknown as PlacedItem;
    expect(itemAsset(item, { [asset.id]: asset })).toBe(asset);
    expect(itemAsset(shape(), { [asset.id]: asset })).toBeUndefined();
    expect(brandTarget(asset)).toEqual({ kind: 'video', source: { path: '/Volumes/素材/片头.mp4' } });
    expect(brandTarget(undefined)).toEqual({ reason: OFF_REASON.brand });
  });

  it('shape: color and stroke open a popover; shape parameters are fixed fields, editable for any shape', () => {
    expect(find(toolbarFor(shape()), 'border')?.action).toEqual({ kind: 'pop' });
    expect(find(toolbarFor(shape({ shape: 'star', fill: '#FF0000' })), 'color')?.action).toEqual({ kind: 'pop' });
  });
});

describe('subtitle toolbar', () => {
  it('bilingual: the bar is "source | translation │ color font size │ edit style animation", menus follow the prototype', () => {
    const spec = captionToolbar({ paired: true, styled: true });
    expect(spec.kind).toBe('subtitle');
    expect(ids(spec.visible)).toEqual([['sub-scope'], ['color', 'font', 'size'], ['sub-edit', 'sub-style', 'sub-animation']]);
    expect(menuIds(spec.more)).toEqual([
      [
        ['bold', 'italic'],
        ['align-left', 'align-center', 'align-right', 'case'],
      ],
      ['line-height', 'letter-spacing'],
      ['save-to-brand-kit', 'hide-subs'],
    ]);
  });

  it('with only one line type, there is no "source | translation" section', () => {
    expect(ids(captionToolbar({ paired: false, styled: true }).visible)).toEqual([
      ['color', 'font', 'size'],
      ['sub-edit', 'sub-style', 'sub-animation'],
    ]);
  });

  it('no delete, and no "this line / all" or "apply to global" that do not exist in the format', () => {
    const tools = allTools(captionToolbar({ paired: true, styled: true })).map((t) => t.id as string);
    for (const id of ['delete', 'sub-cue-scope', 'apply-style-to-global']) expect(tools).not.toContain(id);
  });

  it('color, font, size open a popover; B / I / align are toggles; line height and letter spacing drill down; animation opens the "current word" section of the properties page', () => {
    const spec = captionToolbar({ paired: true, styled: true });
    expect(find(spec, 'color')?.action).toEqual({ kind: 'pop' });
    expect(find(spec, 'size')?.action).toEqual({ kind: 'pop' });
    expect(find(spec, 'italic')?.action).toEqual({ kind: 'toggle' });
    expect(find(spec, 'align-right')?.action).toEqual({ kind: 'toggle' });
    expect(find(spec, 'letter-spacing')?.action).toEqual({ kind: 'sub' });
    expect(find(spec, 'sub-edit')?.action).toEqual({ kind: 'command' });
    expect(find(spec, 'hide-subs')?.action).toEqual({ kind: 'command' });
    expect(find(spec, 'sub-animation')?.action).toEqual({ kind: 'command' });
    for (const tool of allTools(spec)) {
      expect(tool.label).toBe(TOOL_LABEL[tool.id]);
      expect(tool.label.length).toBeGreaterThan(0);
    }
  });

  it('cannot save to the brand library while the default style is still in use; it can be saved once there is a style document', () => {
    expect(find(captionToolbar({ paired: false, styled: false }), 'save-to-brand-kit')?.action).toEqual({
      kind: 'off',
      reason: OFF_REASON.captionDefaultStyle,
    });
    expect(find(captionToolbar({ paired: false, styled: true }), 'save-to-brand-kit')?.action).toEqual({ kind: 'command' });
  });

  it('case cycles through "as is → uppercase → capitalize → lowercase"; capitalize counts as title-case', () => {
    expect(captionCase(undefined)).toBe('none');
    expect(captionCase('capitalize')).toBe('title');
    expect(nextCaptionCase(undefined)).toBe('uppercase');
    expect(nextCaptionCase('uppercase')).toBe('title');
    expect(nextCaptionCase('capitalize')).toBe('lowercase');
    expect(nextCaptionCase('lowercase')).toBe('none');
  });
});

describe('placement', () => {
  const area = { w: 800, h: 450 };
  const bar = { w: 200, h: 30 };

  it('first placed 12px above the selection box, horizontally centered on it', () => {
    expect(toolbarPlacement({ x: 300, y: 200, w: 200, h: 100 }, area, bar, false)).toEqual({ left: 300, top: 158, below: false, maxWidth: 784 });
  });

  it('with a rotate handle, raised to 50px to clear it', () => {
    expect(toolbarPlacement({ x: 300, y: 200, w: 200, h: 100 }, area, bar, true).top).toBe(120);
  });

  it('if the top touches the stage top, flips below; if it does not fit below either, clamped within the bottom edge', () => {
    expect(toolbarPlacement({ x: 300, y: 20, w: 200, h: 100 }, area, bar, false)).toMatchObject({ top: 132, below: true });
    expect(toolbarPlacement({ x: 300, y: 10, w: 200, h: 430 }, area, bar, false)).toMatchObject({ top: 412, below: true });
  });

  it('horizontally clamped within the stage; when the stage is narrower than the bar, a maximum width is given', () => {
    expect(toolbarPlacement({ x: -50, y: 200, w: 100, h: 50 }, area, bar, false).left).toBe(8);
    expect(toolbarPlacement({ x: 760, y: 200, w: 100, h: 50 }, area, bar, false).left).toBe(592);
    expect(toolbarPlacement({ x: 10, y: 200, w: 100, h: 50 }, { w: 160, h: 450 }, bar, false)).toMatchObject({ left: 8, maxWidth: 144 });
  });
});
