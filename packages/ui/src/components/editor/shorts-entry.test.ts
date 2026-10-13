import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { getLocale, setLocale, type Locale } from '@cuccut/protocol';
import { useEditor } from '../../state/editor-store.ts';
import { SHORTS_COPY as S } from './shorts-copy.ts';
import { clearCutOrigin, closeCutEntry, consumeCutJump, openCutEntry, useCutEntry } from './shorts-entry.ts';
import { useTranscriptMode } from './transcript-mode.ts';

// Node has no usable localStorage: provide an in-memory version for persistence, loaded before the store module.
vi.hoisted(() => {
  const data = new Map<string, string>();
  Object.defineProperty(globalThis, 'localStorage', {
    configurable: true,
    value: {
      getItem: (key: string) => data.get(key) ?? null,
      setItem: (key: string, value: string) => void data.set(key, value),
      removeItem: (key: string) => void data.delete(key),
    },
  });
});

beforeEach(() => {
  useEditor.setState({ videoId: 'v_child', panelTab: 'aitools', panelHidden: false });
  useCutEntry.setState({ origin: null, jump: null, seen: 0 });
  useTranscriptMode.setState({ mode: 'edit' });
});

describe('entering the script adjusts the start and end', () => {
  it('opens the transcript in cut mode, remembers where it came from and asks for one scroll', () => {
    openCutEntry('v_child', false);
    expect(useEditor.getState()).toMatchObject({ panelTab: 'transcript', panelHidden: false });
    expect(useTranscriptMode.getState().mode).toBe('cut');
    const { origin, jump } = useCutEntry.getState();
    expect(origin).toEqual({ videoId: 'v_child', tab: 'aitools' });
    expect(jump?.videoId).toBe('v_child');
    consumeCutJump(jump!.n);
    expect(useCutEntry.getState().seen).toBe(jump!.n);
  });

  it('goes back to the remembered panel and forgets it', () => {
    useEditor.setState({ panelTab: 'video' });
    openCutEntry('v_child', false);
    closeCutEntry();
    expect(useEditor.getState().panelTab).toBe('video');
    expect(useCutEntry.getState().origin).toBeNull();
  });

  it('forgets the origin when the panel changes another way, or the video changes', () => {
    openCutEntry('v_child', false);
    useEditor.getState().showPanel('subtitle');
    expect(useCutEntry.getState().origin).toBeNull();

    openCutEntry('v_child', false);
    useEditor.setState({ videoId: 'v_other' });
    expect(useCutEntry.getState()).toMatchObject({ origin: null, jump: null });

    useEditor.setState({ videoId: 'v_child', panelTab: 'video' });
    openCutEntry('v_child', false);
    clearCutOrigin();
    expect(useCutEntry.getState().origin).toBeNull();
  });

  it('records no origin from a hidden pane or a web host showing the transcript for AI tools', () => {
    useEditor.setState({ panelTab: 'video', panelHidden: true });
    openCutEntry('v_child', false);
    expect(useCutEntry.getState().origin).toBeNull();
    expect(useEditor.getState().panelHidden).toBe(false);

    useEditor.setState({ panelTab: 'aitools', panelHidden: false });
    openCutEntry('v_child', true);
    expect(useCutEntry.getState().origin).toBeNull();
  });
});

describe('copy for returning to <panel>', () => {
  const initial = getLocale();
  const use = (locale: Locale) => {
    vi.stubEnv('CUCCUT_LOCALE', locale);
    setLocale(locale);
  };
  afterEach(() => {
    vi.unstubAllEnvs();
    setLocale(initial);
  });

  it('puts a space before a Latin label in Chinese and reads naturally in English', () => {
    use('zh-Hans');
    expect(S.cutBack('视频')).toBe('回到视频');
    expect(S.cutBack('AI 工具')).toBe('回到 AI 工具');
    expect(S.cutAdjust).toBe('去文稿调整');
    expect(S.cutTrim).toBe('调起止');
    expect(S.cutHint).toBe('片段外的话已划掉，点一下放回来');
    use('en');
    expect(S.cutBack('Video')).toBe('Back to Video');
    expect(S.cutBackResult).toBe('Back to results');
  });
});
