import { setLocale } from '@cuccut/protocol';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { HELP_COPY } from '../copy.ts';
import { HELP_GUIDES, HELP_MORE, helpCta, quickStart, searchGuides, type HelpGuide } from './help-guides.ts';

const guide = (id: string): HelpGuide => {
  const found = HELP_GUIDES.find((g) => g.id === id);
  if (!found) throw new Error(`没有指南 ${id}`);
  return found;
};

describe('searchGuides', () => {
  it('searches by Chinese and English keywords and symptoms in the body, case-insensitive', () => {
    expect(searchGuides('  CaPtIoN  ').some((g) => g.id === 'subtitle')).toBe(true);
    expect(searchGuides('画面外').some((g) => g.id === 'missing')).toBe(true);
    expect(searchGuides('字幕 不显示').map((g) => g.id)).toEqual(['missing']);
  });

  it('empty query keeps the directory; non-matching queries return no unrelated guides', () => {
    expect(searchGuides(' \n ')).toEqual(HELP_GUIDES);
    expect(searchGuides('不存在的帮助主题')).toEqual([]);
  });

  it('guides without a short name are not matched by the string "null" from an empty value', () => {
    expect(searchGuides('null')).toEqual([]);
  });
});

describe('directory', () => {
  it('ids are unique and every guide has three steps', () => {
    expect(new Set(HELP_GUIDES.map((g) => g.id)).size).toBe(HELP_GUIDES.length);
    for (const g of HELP_GUIDES) expect(g.steps).toHaveLength(3);
  });

  it('every quick-start guide has a path card short name; the rest do not', () => {
    for (const g of HELP_GUIDES) expect(g.short !== null).toBe(g.group === 'start');
    expect(quickStart().map((g) => g.id)).toEqual(['import', 'subtitle', 'translate', 'export']);
  });

  it('"You might also want to know" links point to existing guides', () => {
    for (const id of HELP_MORE) expect(HELP_GUIDES.some((g) => g.id === id)).toBe(true);
  });

  it('body uses "video", not the old "影片", and does not mention features that do not exist here (quick fix, 剪映 projects, size estimates...)', () => {
    const text = JSON.stringify(HELP_GUIDES);
    for (const word of ['影片', 'yt-dlp', '音源分离', 'AI Tools', '快速修补', '剪映', 'CapCut', 'Final Cut', 'FLAC', '估算']) expect(text).not.toContain(word);
  });
});

describe('helpCta', () => {
  it('destinations that do not need a video work as usual', () => {
    expect(helpCta(guide('import'), false)).toEqual({ label: '从文件新建视频', target: 'new', needsVideo: false });
    expect(helpCta(guide('agent'), false).target).toBe('agent');
    expect(helpCta(guide('model'), true).target).toBe('models');
  });

  it('with no video open, actions that need a video are replaced with "choose a video"', () => {
    for (const id of ['subtitle', 'translate', 'export', 'style', 'workspace', 'missing'])
      expect(helpCta(guide(id), false)).toEqual({ label: HELP_COPY.pickVideo, target: 'space', needsVideo: true });
  });

  it('with a video open: subtitles open the subtitles page; styles and the rest only return to the video', () => {
    expect(helpCta(guide('subtitle'), true)).toEqual({ label: '打开字幕面板', target: 'subtitle', needsVideo: false });
    expect(helpCta(guide('style'), true)).toEqual({ label: HELP_COPY.backToVideo, target: 'close', needsVideo: false });
    expect(helpCta(guide('reframe'), true)).toEqual({ label: HELP_COPY.backToVideo, target: 'close', needsVideo: false });
  });

  it('translation opens the subtitles page ("+ Translate to…" is there); the export dialog help cannot open, so it only returns to the video', () => {
    expect(helpCta(guide('translate'), true)).toEqual({ label: '打开字幕面板', target: 'subtitle', needsVideo: false });
    expect(helpCta(guide('export'), true)).toEqual({ label: HELP_COPY.backToVideo, target: 'close', needsVideo: false });
  });
});

describe('English UI', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    setLocale('zh-Hans');
  });

  it('body and buttons switch to English, structure unchanged; searches by English keywords', () => {
    vi.stubEnv('CUCCUT_LOCALE', 'en');
    setLocale('en');
    expect(guide('import').title).toBe('Create a video and import assets');
    for (const g of HELP_GUIDES) expect(g.steps).toHaveLength(3);
    expect(helpCta(guide('import'), false)).toEqual({ label: 'New video from file', target: 'new', needsVideo: false });
    expect(searchGuides('subtitles NOT SHOWING').map((g) => g.id)).toEqual(['missing']);
    expect(searchGuides('字幕')).toEqual([]);
  });
});
