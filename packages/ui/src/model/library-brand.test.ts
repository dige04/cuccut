import { describe, expect, it } from 'vitest';
import type { AssetRecord, AssetRevision, BrandContent, CaptionItem, DocumentRecord, Sequence, Track } from '@cuccut/protocol';
import {
  BRAND_SECTIONS,
  assetLibrarySource,
  brandCandidates,
  brandKindForAsset,
  brandMeta,
  brandPlacement,
  captionStyleCandidates,
  captionStyleProblem,
  captionStyleTargets,
  colorCss,
  isDynamicSticker,
  lottieLayer,
  nameFromPath,
  normalizeColor,
  stickerMatches,
} from './library-brand.ts';

const revision = (patch: Partial<AssetRevision>): AssetRevision => ({
  revision: 'r1',
  contentHash: 'sha256:00',
  byteLength: 10,
  mediaType: 'image/png',
  storage: { mode: 'managed' },
  provenance: { origin: 'import' },
  ...patch,
});

const asset = (id: string, kind: AssetRecord['kind'], name: string, patch: Partial<AssetRevision> = {}): AssetRecord => ({
  id,
  kind,
  name,
  currentRevision: 'r1',
  revisions: { r1: revision(patch) },
});

const file = (mediaType: string, byteLength = 2048) => ({ sha256: 'sha256:aa', byteLength, mediaType, fileName: 'x' });

describe('sections and names', () => {
  it('sections in design-spec order, without templates', () => {
    expect(BRAND_SECTIONS.map((s) => s.kind)).toEqual(['video', 'image', 'sticker', 'color', 'font', 'captionStyle']);
  });

  it('a local file\'s default name is its file name without the extension', () => {
    expect(nameFromPath('/Users/me/台标 2026.png')).toBe('台标 2026');
    expect(nameFromPath('C:\\brand\\logo.final.webp')).toBe('logo.final');
    expect(nameFromPath('/tmp/.hidden')).toBe('.hidden');
    expect(nameFromPath('')).toBe('未命名');
  });
});

describe('brand color', () => {
  it('accepts only six- or eight-digit hex, stored in uppercase; three-digit expanded', () => {
    expect(normalizeColor('#ff5a1f')).toBe('#FF5A1F');
    expect(normalizeColor('ff5a1f80')).toBe('#FF5A1F80');
    expect(normalizeColor(' #abc ')).toBe('#AABBCC');
    expect(normalizeColor('#12345')).toBeNull();
    expect(normalizeColor('red')).toBeNull();
  });

  it('CSS uses rgba, including the opacity', () => {
    expect(colorCss('#FF0000')).toBe('rgba(255, 0, 0, 1)');
    expect(colorCss('#00FF0080')).toBe('rgba(0, 255, 0, 0.502)');
  });
});

describe('item descriptions and how to place them', () => {
  it('stickers state whether they are image or Lottie; files state the size', () => {
    const lottie: BrandContent = { name: 'a', kind: 'sticker', file: file('application/json', 3 * 1024 * 1024) };
    expect(brandMeta(lottie)).toBe('Lottie 动画 · 3.0 MB');
    expect(brandMeta({ name: 'b', kind: 'image', file: file('image/png', 500) })).toBe('500 B');
    expect(brandMeta({ name: 'c', kind: 'color', value: '#112233' })).toBe('#112233');
  });

  it('images, video and image stickers go on the timeline; Lottie uses the built-in player; fonts go only to the media library', () => {
    expect(brandPlacement({ name: 'a', kind: 'image', file: file('image/png') })).toBe('asset');
    expect(brandPlacement({ name: 'a', kind: 'video', file: file('video/mp4') })).toBe('asset');
    expect(brandPlacement({ name: 'a', kind: 'sticker', file: file('image/gif') })).toBe('asset');
    expect(brandPlacement({ name: 'a', kind: 'sticker', file: file('application/json') })).toBe('lottie');
    expect(brandPlacement({ name: 'a', kind: 'sticker', file: file('application/zip') })).toBe('lottie');
    expect(brandPlacement({ name: 'a', kind: 'font', file: file('font/ttf') })).toBe('import-only');
  });

  it('Lottie layer: points to the asset\'s current version, loops, a square 18% of the frame width at the center', () => {
    const layer = lottieLayer('挥手', asset('ast_1', 'other', '挥手', { mediaType: 'application/json' }), { width: 1920, height: 1080 });
    expect(layer).toMatchObject({
      type: 'sticker',
      name: '挥手',
      place: { x: 50, y: 50, w: 18 },
      assetRef: { id: 'ast_1', revision: 'r1' },
      sticker: { source: 'asset', loop: 'loop' },
    });
  });
});

describe('brand library stickers on the elements page', () => {
  it('Lottie goes to the animated stickers page; images (GIFs too, since they render only one frame) go to the stickers page', () => {
    expect(isDynamicSticker({ name: 'a', kind: 'sticker', file: file('application/json') })).toBe(true);
    expect(isDynamicSticker({ name: 'a', kind: 'sticker', file: file('image/gif') })).toBe(true);
    expect(isDynamicSticker({ name: 'a', kind: 'sticker', file: file('image/png') })).toBe(false);
  });

  it('search: name, "我的贴纸 / 品牌库" and that page\'s name; the animated page also matches "贴纸"', () => {
    expect(stickerMatches('台标 Logo', false, '')).toBe(true);
    expect(stickerMatches('台标 Logo', false, ' logo ')).toBe(true);
    expect(stickerMatches('台标 Logo', false, '我的贴纸')).toBe(true);
    expect(stickerMatches('台标 Logo', false, '品牌')).toBe(true);
    expect(stickerMatches('台标 Logo', false, 'lottie')).toBe(false);
    expect(stickerMatches('挥手', true, 'Lottie')).toBe(true);
    expect(stickerMatches('挥手', true, '贴纸')).toBe(true);
    expect(stickerMatches('挥手', true, '动态贴纸')).toBe(true);
    expect(stickerMatches('挥手', false, '动态贴纸')).toBe(false);
    expect(stickerMatches('挥手', true, '台标')).toBe(false);
    // The name and the word list are separated: the tail of the name joined to the head of the word list does not count as a match.
    expect(stickerMatches('挥', false, '挥我')).toBe(false);
  });
});

describe('saved from this video\'s media', () => {
  it('generated media uses the artifact, linked media uses the original path; media copied into the video directory explains why', () => {
    const generated = asset('a', 'image', 'g', { provenance: { origin: 'generated', source: { artifactId: 'sha256:ab' } } });
    expect(assetLibrarySource(generated)).toEqual({ source: { artifactId: 'sha256:ab' } });
    const linked = asset('b', 'video', 'l', { storage: { mode: 'linked', locator: { path: '/Volumes/素材/片头.mp4' }, frozen: false } });
    expect(assetLibrarySource(linked)).toEqual({ source: { path: '/Volumes/素材/片头.mp4' } });
    const relative = asset('c', 'video', 'r', { storage: { mode: 'linked', locator: { path: 'media/片头.mp4' }, frozen: false } });
    expect(assetLibrarySource(relative)).toHaveProperty('reason');
    expect(assetLibrarySource(asset('d', 'image', 'm'))).toHaveProperty('reason');
  });

  it('picking media by section: the stickers section takes images and Lottie, not audio', () => {
    const assets = {
      a: asset('a', 'image', 'B 台标'),
      b: asset('b', 'other', 'A 挥手', { mediaType: 'application/json' }),
      c: asset('c', 'audio', '片头曲', { mediaType: 'audio/mpeg' }),
      d: asset('d', 'font', '思源', { mediaType: 'font/otf' }),
      e: asset('e', 'lottie', 'C 波浪', { mediaType: 'application/zip' }),
    };
    expect(brandKindForAsset(assets.c)).toBeNull();
    expect(brandKindForAsset(assets.e)).toBe('sticker');
    expect(brandCandidates(assets, 'sticker').map((c) => c.asset.id)).toEqual(['b', 'a', 'e']);
    expect(brandCandidates(assets, 'image').map((c) => c.asset.id)).toEqual(['a']);
    expect(brandCandidates(assets, 'font').map((c) => [c.asset.id, c.source, !!c.reason])).toEqual([['d', null, true]]);
  });
});

describe('subtitle style', () => {
  it('must include a schema, no larger than 64 KiB', () => {
    expect(captionStyleProblem({ schema: 'cuccut.caption-style/1', style: {} })).toBeNull();
    expect(captionStyleProblem({ style: {} })).toBe('字幕样式文档没有 schema，存不进品牌库');
    expect(captionStyleProblem(null)).toBe('字幕样式文档是空的');
    expect(captionStyleProblem({ schema: 's', pad: 'x'.repeat(70 * 1024) })).toBe('字幕样式超过 64 KiB');
  });

  const base = { enabled: true, locked: false, paintOrder: 0, followPolicy: { kind: 'sequence-fixed' as const } };
  const track = (id: string, locked = false): Track => ({
    id,
    order: 1,
    kind: 'subtitle',
    locked,
    visible: true,
    muted: false,
    solo: { enabled: false, group: 'visual' },
  });
  const caption = (id: string, trackId: string, extra: Partial<CaptionItem> = {}): CaptionItem => ({
    ...base,
    id,
    trackId,
    type: 'caption',
    span: { fromFrame: 0, durationFrames: 30 },
    documentId: 'cap',
    ...extra,
  });
  const doc = (id: string, kind: string, name: string): DocumentRecord => ({ id, kind, name, currentRevision: '1', revisions: {} });
  const sequence = (tracks: Track[], items: Sequence['items']): Sequence => ({
    id: 'seq',
    revision: '1',
    name: '主序列',
    fps: { num: 30, den: 1 },
    canvas: { width: 1920, height: 1080, workingSpace: 'srgb', background: '#000000' },
    durationPolicy: { kind: 'derived' },
    tracks,
    items,
    animationBindings: [],
    transitions: [],
    markers: [],
    ducking: [],
  });

  it('styles that can be saved: caption-style documents in use for subtitles, most-used first', () => {
    const documents = {
      a: doc('a', 'caption-style', '原文样式'),
      b: doc('b', 'caption-style', '译文样式'),
      x: doc('x', 'caption', '不是样式'),
    };
    const seq = sequence(
      [track('t1')],
      [
        caption('c1', 't1', { styleDocumentId: 'a' }),
        caption('c2', 't1', { styleDocumentId: 'b' }),
        caption('c3', 't1', { styleDocumentId: 'b' }),
        caption('c4', 't1', { styleDocumentId: 'x' }),
        caption('c5', 't1', { styleDocumentId: 'gone' }),
        caption('c6', 't1'),
      ],
    );
    expect(captionStyleCandidates(seq, documents)).toEqual([
      { documentId: 'b', name: '译文样式', uses: 2 },
      { documentId: 'a', name: '原文样式', uses: 1 },
    ]);
    expect(captionStyleCandidates(sequence([track('t1')], []), documents)).toEqual([]);
  });

  it('applying changes subtitles on the sequence, skipping locked instances and locked tracks', () => {
    const seq = sequence(
      [track('t1'), track('t2', true)],
      [caption('c1', 't1'), caption('c2', 't1', { locked: true }), caption('c3', 't2')],
    );
    expect(captionStyleTargets(seq)).toEqual(['c1']);
  });
});
