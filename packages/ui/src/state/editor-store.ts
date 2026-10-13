import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import type { Id, Revision } from '@cuccut/protocol';
import { mergeDraft, type ItemDraft } from '../model/item-draft.ts';
import { ZOOM_DEFAULT, ZOOM_MIN, clampZoom } from '../model/timeline-zoom.ts';

/**
 * Editor UI state: the selection, playhead, zoom and panel width. Belongs only to this window.
 * Kept when switching between Home and Space, and when the session is collapsed or expanded (product design §5.1).
 */

export { ZOOM_DEFAULT, ZOOM_MAX, ZOOM_MIN } from '../model/timeline-zoom.ts';
export const TIMELINE_HEIGHT_DEFAULT = 240;
export const TIMELINE_HEIGHT_MIN = 140;

/** Right panel (prototype model-layout.js pane): default 360, range 300–560. Dragging it below 340 collapses it; expanding returns it to the width it had before collapsing. */
export const PANEL_WIDTH_DEFAULT = 360;
export const PANEL_WIDTH_MIN = 300;
export const PANEL_WIDTH_MAX = 560;
export const PANEL_COLLAPSE_BELOW = 340;

/**
 * Pages of the right panel: script, subtitles, AI tools, elements, text, the three asset libraries, brand, and properties (the clip's properties when a clip is selected, otherwise the video's).
 * `aitools` is the AI tools tab: the list page and each tool's parameter page (product design §5.10). Desktop only.
 */
export type PanelTab = 'transcript' | 'subtitle' | 'aitools' | 'elements' | 'text' | 'image' | 'video' | 'audio' | 'brand' | 'props';

/** The web host has no AI tools tab (prototype model-surface.js `WEB_RAIL_DROP`). The toolbar does not show it, and if it was the remembered page, it falls back to the script. */
export function hostPanelTab(tab: PanelTab, web: boolean): PanelTab {
  return web && tab === 'aitools' ? 'transcript' : tab;
}

/** Subtitle style being dragged and not yet committed. The preview reads this body in place of the document's `baseRevision` version (see DraftDocuments in video-editor). */
export interface DocumentDraft {
  documentId: Id;
  baseRevision: Revision;
  body: unknown;
}

/** Words selected in the script panel: word indexes within the same transcript. `anchor`–`focus` is the span being dragged, and `extra` holds the other spans gathered by ⌘-clicking. */
export interface WordSelection {
  assetId: Id;
  anchor: number;
  focus: number;
  extra: Array<[number, number]>;
}

export interface EditorStore {
  /** Which video is open. When the video changes, the selection and playhead are cleared. */
  videoId: Id | null;
  selection: Id[];
  /**
   * Words selected in the script panel (not persisted). They are mutually exclusive with `selection` (product design §5.7: no cross-mode deletion). Selecting words clears the clip selection,
   * and selecting clips clears the word selection. Otherwise the transport's delete button and ⌫ would delete clips rather than the words in front of you. Clearing either side leaves the other alone.
   */
  wordSelection: WordSelection | null;
  /** Playhead (seconds). */
  playhead: number;
  playing: boolean;
  /** Timeline zoom: pixels per second. */
  pxPerSecond: number;
  /**
   * Lower bound for zooming out (not persisted). The timeline writes it from the duration and lane width (zoomFloor in model/timeline-zoom).
   * `setZoom` clamps to [min(ZOOM_MIN, zoomFloor), ZOOM_MAX]. The wheel, buttons, menus and shortcuts all go through this one place.
   */
  zoomFloor: number;
  timelineHeight: number;
  panelTab: PanelTab;
  panelWidth: number;
  /** Right panel collapsed: click the current page again, or drag the panel narrower than the collapse line. The toolbar always stays visible. */
  panelHidden: boolean;
  /** Draft of the properties page while it is being dragged (not persisted). Dropped when the selection changes. */
  draft: ItemDraft | null;
  documentDraft: DocumentDraft | null;
  /** Switch to another video: the selection and playhead reset to zero. If a landing spot is given, switch to that page (design: material dropped onto the script; an empty landing goes to the video). The same video is left alone. */
  attach(videoId: Id, landing?: PanelTab): void;
  select(ids: Id[]): void;
  toggleSelect(id: Id): void;
  setWordSelection(next: WordSelection | null | ((prev: WordSelection | null) => WordSelection | null)): void;
  setPlayhead(seconds: number): void;
  setPlaying(playing: boolean): void;
  setZoom(pxPerSecond: number): void;
  /** Write the new lower bound, and clamp the current zoom back into range. (When switching from a long video to a short one, the very small zoom goes back to ZOOM_MIN.) */
  setZoomFloor(floor: number): void;
  setTimelineHeight(height: number): void;
  /** Open a page. `null` collapses the panel. */
  showPanel(tab: PanelTab | null): void;
  /** Dragging the seam on the left edge of the panel: below the collapse line it collapses. The width is kept for the next expand. */
  dragPanel(width: number): void;
  /** Record the value being dragged. Drafts for the same clip and the same version are layered together. */
  setDraft(draft: ItemDraft): void;
  setDocumentDraft(draft: DocumentDraft): void;
  /** Drop the draft (when the commit fails, return to the original value). */
  clearDrafts(): void;
  /** Time nudge accumulated from repeated ⌥←/→ presses (not persisted). The timeline draws the offset from it, and after a pause it is committed as one combined change. See nudgeTime in timeline-commands. */
  nudge: NudgeDraft | null;
  setNudge(nudge: NudgeDraft | null): void;
  /** The shortcut list (`?`) is open. */
  shortcutsOpen: boolean;
  setShortcutsOpen(open: boolean): void;
  /**
   * The preview is playing fullscreen (not persisted). It follows the browser's `fullscreenchange` (preview.tsx), and the browser's own Esc exit counts too.
   * While fullscreen, the keyboard belongs to the fullscreen player, and the editor's shortcuts yield.
   */
  fullscreen: boolean;
  setFullscreen(fullscreen: boolean): void;
  /**
   * View state of the toolbar along the bottom edge of the stage (prototype stage.jsx `StageBar`; none are persisted, and they reset when the video changes). They only control how this window looks. They do not enter the video or undo history,
   * and they do not affect export. The speed-stage and the fullscreen player share one set. Hiding subtitles only affects the stage (fullscreen has its own four levels). The platform safe area is drawn only on portrait canvases.
   */
  rate: number;
  setRate(rate: number): void;
  captionsHidden: boolean;
  setCaptionsHidden(hidden: boolean): void;
  safeArea: boolean;
  setSafeArea(on: boolean): void;
}

/** Time nudges not yet committed (or being committed): which clips, how many frames have accumulated, and which video version they are computed against. */
export interface NudgeDraft {
  itemIds: Id[];
  deltaFrames: number;
  /** Video version. When the version changes (a commit landed or someone else edited), the accumulated offset is no longer applied. */
  revision: Revision;
  /** Commit already sent, awaiting its receipt. */
  committing: boolean;
}

export const useEditor = create<EditorStore>()(
  persist(
    (set) => ({
      videoId: null,
      selection: [],
      wordSelection: null,
      playhead: 0,
      playing: false,
      pxPerSecond: ZOOM_DEFAULT,
      zoomFloor: ZOOM_MIN,
      timelineHeight: TIMELINE_HEIGHT_DEFAULT,
      panelTab: 'video',
      panelWidth: PANEL_WIDTH_DEFAULT,
      panelHidden: false,
      draft: null,
      documentDraft: null,
      attach: (videoId, landing) =>
        set((s) =>
          s.videoId === videoId
            ? {}
            : {
                videoId,
                selection: [],
                wordSelection: null,
                playhead: 0,
                playing: false,
                draft: null,
                documentDraft: null,
                rate: 1,
                captionsHidden: false,
                safeArea: false,
                ...(landing ? { panelTab: landing } : {}),
              },
        ),
      select: (selection) => set({ selection, draft: null, documentDraft: null, ...(selection.length ? { wordSelection: null } : {}) }),
      toggleSelect: (id) =>
        set((s) => {
          const selection = s.selection.includes(id) ? s.selection.filter((x) => x !== id) : [...s.selection, id];
          return { selection, draft: null, documentDraft: null, ...(selection.length ? { wordSelection: null } : {}) };
        }),
      // Every word passed during a drag-select writes this, so only clear when a clip is really selected. Otherwise `selection` is replaced each time and the timeline is redrawn.
      setWordSelection: (next) =>
        set((s) => {
          const wordSelection = typeof next === 'function' ? next(s.wordSelection) : next;
          return wordSelection && s.selection.length
            ? { wordSelection, selection: [], draft: null, documentDraft: null }
            : { wordSelection };
        }),
      setPlayhead: (playhead) => set({ playhead: Math.max(0, playhead) }),
      setPlaying: (playing) => set({ playing }),
      setZoom: (pxPerSecond) => set((s) => ({ pxPerSecond: clampZoom(pxPerSecond, s.zoomFloor) })),
      setZoomFloor: (zoomFloor) => set((s) => ({ zoomFloor, pxPerSecond: clampZoom(s.pxPerSecond, zoomFloor) })),
      setTimelineHeight: (height) => set({ timelineHeight: Math.round(Math.max(TIMELINE_HEIGHT_MIN, height)) }),
      showPanel: (tab) => set(tab ? { panelTab: tab, panelHidden: false } : { panelHidden: true }),
      dragPanel: (width) =>
        set(
          width < PANEL_COLLAPSE_BELOW
            ? { panelHidden: true }
            : { panelWidth: Math.round(Math.min(PANEL_WIDTH_MAX, Math.max(PANEL_WIDTH_MIN, width))) },
        ),
      setDraft: (draft) => set((s) => ({ draft: mergeDraft(s.draft, draft) })),
      setDocumentDraft: (documentDraft) => set({ documentDraft }),
      clearDrafts: () => set({ draft: null, documentDraft: null }),
      nudge: null,
      setNudge: (nudge) => set({ nudge }),
      shortcutsOpen: false,
      setShortcutsOpen: (shortcutsOpen) => set({ shortcutsOpen }),
      fullscreen: false,
      setFullscreen: (fullscreen) => set({ fullscreen }),
      rate: 1,
      setRate: (rate) => set({ rate }),
      captionsHidden: false,
      setCaptionsHidden: (captionsHidden) => set({ captionsHidden }),
      safeArea: false,
      setSafeArea: (safeArea) => set({ safeArea }),
    }),
    {
      name: 'cuccut.editor',
      version: 1,
      storage: createJSONStorage(() => localStorage),
      partialize: (s) => ({
        pxPerSecond: s.pxPerSecond,
        timelineHeight: s.timelineHeight,
        panelTab: s.panelTab,
        panelWidth: s.panelWidth,
        panelHidden: s.panelHidden,
      }),
    },
  ),
);
