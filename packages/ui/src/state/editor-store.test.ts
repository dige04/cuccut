import { beforeEach, describe, expect, it, vi } from 'vitest';
import { hostPanelTab, PANEL_WIDTH_DEFAULT, PANEL_WIDTH_MAX, useEditor, ZOOM_DEFAULT, ZOOM_MAX, ZOOM_MIN } from './editor-store.ts';

// Node has no usable localStorage: give persistence an in-memory version, loaded before the store module.
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

describe('editor right-side panel', () => {
  beforeEach(() => useEditor.setState({ panelTab: 'video', panelWidth: PANEL_WIDTH_DEFAULT, panelHidden: false }));

  it('clicking the toolbar switches the page and expands; passing null collapses it, the page is kept', () => {
    useEditor.getState().showPanel(null);
    expect(useEditor.getState()).toMatchObject({ panelTab: 'video', panelHidden: true });
    useEditor.getState().showPanel('props');
    expect(useEditor.getState()).toMatchObject({ panelTab: 'props', panelHidden: false });
  });

  it('switching to another video lands on the given page; reopening the same video does not change the page the user switched to', () => {
    useEditor.setState({ videoId: null });
    useEditor.getState().attach('v1', 'transcript');
    expect(useEditor.getState()).toMatchObject({ videoId: 'v1', panelTab: 'transcript' });
    useEditor.getState().showPanel('audio');
    useEditor.getState().attach('v1', 'transcript');
    expect(useEditor.getState().panelTab).toBe('audio');
    useEditor.getState().attach('v2');
    expect(useEditor.getState()).toMatchObject({ videoId: 'v2', panelTab: 'audio' });
  });

  it('stage toolbar viewing state (playback speed, subtitle hiding, safe area) resets when switching videos; reopening the same video does not change it', () => {
    useEditor.setState({ videoId: null });
    useEditor.getState().attach('v1');
    useEditor.getState().setRate(1.5);
    useEditor.getState().setCaptionsHidden(true);
    useEditor.getState().setSafeArea(true);
    useEditor.getState().attach('v1');
    expect(useEditor.getState()).toMatchObject({ rate: 1.5, captionsHidden: true, safeArea: true });
    useEditor.getState().attach('v2');
    expect(useEditor.getState()).toMatchObject({ rate: 1, captionsHidden: false, safeArea: false });
  });

  it('drag seam: width is clamped to the limit; dragging below the collapse line collapses it, the remembered width is unchanged', () => {
    useEditor.getState().dragPanel(420.4);
    expect(useEditor.getState().panelWidth).toBe(420);
    useEditor.getState().dragPanel(900);
    expect(useEditor.getState().panelWidth).toBe(PANEL_WIDTH_MAX);
    useEditor.getState().dragPanel(320);
    expect(useEditor.getState()).toMatchObject({ panelWidth: PANEL_WIDTH_MAX, panelHidden: true });
    useEditor.getState().showPanel('audio');
    expect(useEditor.getState()).toMatchObject({ panelTab: 'audio', panelWidth: PANEL_WIDTH_MAX, panelHidden: false });
  });
});

describe('panel page on the web host', () => {
  it('if the remembered one is the AI tool, falls back to the script; desktop unchanged', () => {
    expect(hostPanelTab('aitools', true)).toBe('transcript');
    expect(hostPanelTab('aitools', false)).toBe('aitools');
    expect(hostPanelTab('subtitle', true)).toBe('subtitle');
  });
});

describe('timeline zoom lower bound', () => {
  beforeEach(() => useEditor.setState({ pxPerSecond: ZOOM_DEFAULT, zoomFloor: ZOOM_MIN }));

  it('short videos are clamped to [ZOOM_MIN, ZOOM_MAX]', () => {
    useEditor.getState().setZoom(0.5);
    expect(useEditor.getState().pxPerSecond).toBe(ZOOM_MIN);
    useEditor.getState().setZoom(1e6);
    expect(useEditor.getState().pxPerSecond).toBe(ZOOM_MAX);
  });

  it('for long videos the lower bound is below ZOOM_MIN: can zoom out until the whole video fits in view', () => {
    useEditor.getState().setZoomFloor(0.2);
    useEditor.getState().setZoom(0.01);
    expect(useEditor.getState().pxPerSecond).toBe(0.2);
  });

  it('when switching to a short video, a remembered tiny zoom is clamped back to ZOOM_MIN', () => {
    useEditor.setState({ pxPerSecond: 0.2, zoomFloor: 0.2 });
    useEditor.getState().setZoomFloor(ZOOM_MIN);
    expect(useEditor.getState().pxPerSecond).toBe(ZOOM_MIN);
  });
});

describe('clip selection and script word selection are mutually exclusive (product design §5.7)', () => {
  const words = { assetId: 'a1', anchor: 2, focus: 5, extra: [] as Array<[number, number]> };
  beforeEach(() => useEditor.setState({ selection: [], wordSelection: null, draft: null, documentDraft: null }));

  it('selecting words clears the clip selection and draft; clearing the word selection does not change the clip selection', () => {
    useEditor.getState().select(['i1']);
    useEditor.setState({ documentDraft: { documentId: 'd1', baseRevision: 'r1', body: {} } });
    useEditor.getState().setWordSelection(words);
    expect(useEditor.getState()).toMatchObject({ selection: [], wordSelection: words, documentDraft: null });
    useEditor.setState({ selection: ['i2'], wordSelection: null });
    useEditor.getState().setWordSelection(null);
    expect(useEditor.getState().selection).toEqual(['i2']);
  });

  it('drag-select word expansion (update function) follows the same rule; without a clip selection, selection is not replaced', () => {
    useEditor.getState().setWordSelection(words);
    const before = useEditor.getState().selection;
    useEditor.getState().setWordSelection((s) => (s ? { ...s, focus: 9 } : s));
    expect(useEditor.getState().wordSelection).toMatchObject({ anchor: 2, focus: 9 });
    expect(useEditor.getState().selection).toBe(before);
  });

  it('selecting clips (click or ⌘ add) clears the word selection; clearing the clip selection does not change the word selection', () => {
    useEditor.getState().setWordSelection(words);
    useEditor.getState().select([]);
    expect(useEditor.getState().wordSelection).toEqual(words);
    useEditor.getState().select(['i1']);
    expect(useEditor.getState()).toMatchObject({ selection: ['i1'], wordSelection: null });
    useEditor.getState().setWordSelection(words);
    useEditor.getState().toggleSelect('i3');
    expect(useEditor.getState()).toMatchObject({ selection: ['i3'], wordSelection: null });
  });

  it('⌘-clicking off the last clip does not affect the word selection; switching videos clears both', () => {
    useEditor.setState({ selection: ['i1'], wordSelection: words });
    useEditor.getState().toggleSelect('i1');
    expect(useEditor.getState()).toMatchObject({ selection: [], wordSelection: words });
    useEditor.setState({ videoId: 'v1' });
    useEditor.getState().attach('v2');
    expect(useEditor.getState().wordSelection).toBeNull();
  });
});
