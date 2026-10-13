import { afterEach, describe, expect, it, vi } from 'vitest';
import { setLocale } from '@cuccut/protocol';
import { preparePercent, stallDetail, stallTopic, waitedSeconds } from './preview-stall.ts';
import type { MediaProbe, StallStep } from './preview-watch.ts';

const ASSETS: Record<string, string> = { asset_a: 'interview.mp4', asset_blank: '  ' };
const DOCUMENTS: Record<string, string> = { doc_cap: 'Original captions' };
const names = { asset: (id: string) => ASSETS[id], document: (id: string) => DOCUMENTS[id] };
const probe = (assetId?: string): MediaProbe => ({
  itemId: 'clip',
  ...(assetId ? { assetId } : {}),
  kind: 'video',
  wait: 'no-element',
  wantedSeconds: 0,
  element: null,
});
const report = (step: StallStep, patch: { media?: MediaProbe[]; documents?: string[]; fonts?: string[] } = {}) => ({
  step,
  media: patch.media ?? [],
  documents: patch.documents ?? [],
  fonts: patch.fonts ?? [],
});

describe('preview stall hint', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    setLocale('zh-Hans');
  });

  it('every diagnostic step maps to a category in the design spec', () => {
    expect(stallTopic('planner-loading')).toBe('engine');
    expect((['no-video', 'video-error', 'no-plan'] as const).map(stallTopic)).toEqual(['video', 'video', 'video']);
    expect(stallTopic('media-pending')).toBe('media');
    expect(stallTopic('media-preparing')).toBe('prepare');
    expect(stallTopic('documents-pending')).toBe('captions');
    expect(stallTopic('fonts-loading')).toBe('fonts');
    expect(stallTopic('not-painted')).toBe('paint');
    expect(stallTopic('no-canvas')).toBe('paint');
  });

  it('name the asset, subtitle document and font being waited on; when the name cannot be found, use a generic description', () => {
    expect(stallDetail(report('media-pending', { media: [probe(), probe('asset_blank'), probe('asset_a')] }), names)).toBe(
      '在等媒体：interview.mp4',
    );
    expect(stallDetail(report('media-pending', { media: [probe('asset_gone')] }), names)).toBe('在等媒体');
    expect(stallDetail(report('media-preparing', { media: [probe('asset_a')] }), names)).toBe('转换媒体没有进展：interview.mp4');
    expect(stallDetail(report('media-preparing', { media: [probe()] }), names)).toBe('转换媒体没有进展');
    expect(stallDetail(report('documents-pending', { documents: ['doc_cap'] }), names)).toBe('在等字幕：Original captions');
    expect(stallDetail(report('documents-pending', { documents: ['doc_gone'] }), names)).toBe('在等字幕');
    expect(stallDetail(report('fonts-loading', { fonts: ['Inter'] }), names)).toBe('在等字体：Inter');
    expect(stallDetail(report('planner-loading'), names)).toBe('预览引擎还在载入');
    expect(stallDetail(report('no-plan'), names)).toBe('还在准备这部视频');
    expect(stallDetail(report('not-painted'), names)).toBe('画面一直没有更新');
  });

  it('English uses the design spec\'s wording', () => {
    vi.stubEnv('CUCCUT_LOCALE', 'en');
    setLocale('en');
    expect(stallDetail(report('media-pending', { media: [probe('asset_a')] }), names)).toBe('Waiting for media: interview.mp4');
    expect(stallDetail(report('planner-loading'), names)).toBe('Preview engine still loading');
    expect(stallDetail(report('media-preparing', { media: [probe('asset_a')] }), names)).toBe('Media conversion isn’t progressing: interview.mp4');
    expect(stallDetail(report('documents-pending', { documents: ['doc_gone'] }), names)).toBe('Waiting for captions');
  });

  it('conversion percentage: rounded down, capped at 99; null when progress is unknown', () => {
    expect([0, 0.009, 0.374, 0.999, 1, 1.5].map(preparePercent)).toEqual([0, 0, 37, 99, 99, 99]);
    expect([null, undefined, Number.NaN, -0.1].map(preparePercent)).toEqual([null, null, null, null]);
  });

  it('seconds already waited: counted from the start of the stall, rounded down', () => {
    expect(waitedSeconds({ since: 2000 }, 12_999)).toBe(10);
    expect(waitedSeconds({ since: 2000 }, 13_000)).toBe(11);
    expect(waitedSeconds({ since: 5000 }, 1000)).toBe(0);
  });
});
