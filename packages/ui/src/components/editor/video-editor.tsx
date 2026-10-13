import { useEffect, useMemo, useRef, type PointerEvent as ReactPointerEvent } from 'react';
import type { Sequence } from '@cuccut/protocol';
import { Button, Content, Heading, IllustratedMessage, ProgressCircle, ToastQueue } from '@react-spectrum/s2';
import { style } from '@react-spectrum/s2/style' with { type: 'macro' };
import { durationSeconds, frameAt, rootSequence } from '../../model/editor.ts';
import { applyDraft } from '../../model/item-draft.ts';
import { monitorGain, monitorLevel, stepMonitor, toggleMute, type MonitorLevel } from '../../model/preview-volume.ts';
import { PREVIEW_KEYS_COPY } from '../../copy.ts';
import { runtimeFonts } from '../../render/local-fonts.ts';
import { downloadingResolve } from '../../render/font-downloads.ts';
import { useRuntime } from '../../runtime/context.tsx';
import { zoomKey } from '../../model/timeline-zoom.ts';
import { TIMELINE_HEIGHT_MIN, useEditor, type PanelTab } from '../../state/editor-store.ts';
import { landingPanel } from '../../model/shorts-entry.ts';
import { readDerivation } from '../../model/shorts-result.ts';
import { useTranscriptMode } from './transcript-mode.ts';
import { useFontLibrary } from '../../state/font-library-store.ts';
import { canEdit, useVideo } from '../../state/video-store.ts';
import { DraftDocuments } from './draft-documents.ts';
import { EditorContext, type EditorActions } from './editor-context.tsx';
import { FontBar } from './font-bar.tsx';
import { VideoBar } from './video-bar.tsx';
import { PreviewEngine } from './preview-engine.ts';
import { enterPreviewFullscreen } from './fullscreen-player.tsx';
import { Preview } from './preview.tsx';
import { SidePanel } from './side-panel.tsx';
import { SoundtrackBed } from './soundtrack-bed.tsx';
import { takePanelLanding } from './ai-tools-nav.ts';
import { ShortsChildBanner } from './shorts-banner.tsx';
import { useShortsLanding } from './shorts-landing.ts';
import { StageLiveCaptions } from './stage-live.tsx';
import type { TimelineHandle } from './timeline.tsx';
import { TimelineCard } from './timeline-card.tsx';
import { InspectorColumn } from './inspector-column.tsx';
import { usePaneActive } from './use-pane-active.ts';
import { useSessionSlotFilled } from '../../cc/components/session-slots.tsx';
import { VideoSettingsDialog } from './video-settings.tsx';
import { ShortcutSheet } from './shortcut-sheet.tsx';
import {
  arrangeSelection,
  copySelection,
  cutSelection,
  deleteSelection,
  dropNudge,
  duplicateSelection,
  flushNudge,
  nudgeTime,
  pasteClipboard,
  removeSelectionSpan,
  selectAtPlayhead,
  splitAtPlayhead,
} from './timeline-commands.ts';
import { EDITOR_COPY as E } from './editor-copy.ts';

const editor = style({ display: 'flex', flexDirection: 'column', flexGrow: 1, minHeight: 0, minWidth: 0, outlineStyle: 'none' });
const centered = style({
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  justifyContent: 'center',
  gap: 12,
  flexGrow: 1,
  font: 'ui',
  color: 'gray-600',
});

/**
 * The video editor (product design §5) in agentcut's layout: the header (in the session's glass header when there is one),
 * then the panel card on the left, the framed preview with the selection's bar under it and the timeline card in the
 * centre, and the selection inspector on the right (under the session's chat when there is one).
 */
export function VideoEditor() {
  const runtime = useRuntime();
  const video = useVideo((s) => s.video);
  const snapshot = video?.state?.video ?? null;
  const sequence = snapshot ? rootSequence(snapshot) : null;
  const rootRef = useRef<HTMLDivElement>(null);
  const timeline = useRef<TimelineHandle | null>(null);
  const timelineHeight = useEditor((s) => s.timelineHeight);
  const active = usePaneActive();
  // In a session the layout already spaces its columns; elsewhere (Space) the pane keeps its own margin.
  const inSession = useSessionSlotFilled('header-actions');
  // Values being dragged in the property page are applied only to the preview and the property page. The timeline, shortcuts and commits all use the actual values in the video.
  const draft = useEditor((s) => s.draft);
  const shown = useMemo(() => sequence && applyDraft(sequence, draft), [sequence, draft]);

  const engine = useMemo(
    () =>
      new PreviewEngine(
        {
          onTime: (seconds) => useEditor.getState().setPlayhead(seconds),
          onEnded: () => useEditor.getState().setPlaying(false),
        },
        undefined,
        new DraftDocuments(runtime.videos.documents),
        runtime.videos.assets,
        // Families not installed locally but present in the font directory are downloaded per settings, and injected once downloaded (§9.1).
        runtimeFonts(downloadingResolve((params) => runtime.client.request('fonts.resolve', params))),
        // While waiting for media of the compatibility copy (so the stuck diagnostics can tell conversion apart from waiting for media): ask the media address cache about the currently open video.
        (asset) => {
          const videoId = useVideo.getState().video?.videoId;
          return videoId ? runtime.videos.mediaUrls.progress(videoId, asset) : undefined;
        },
      ),
    [runtime],
  );
  useEffect(() => {
    engine.resume();
    return () => engine.dispose();
  }, [engine]);
  // When a family becomes downloaded (regardless of who started the download): a family that was reported missing before and was asked for is requested again, and the picture switches automatically.
  useEffect(
    () =>
      useFontLibrary.subscribe((s, prev) => {
        if (s.statuses === prev.statuses) return;
        const done = Object.entries(s.statuses).flatMap(([key, status]) =>
          status.state === 'downloaded' && prev.statuses[key]?.state !== 'downloaded' ? [status.family] : [],
        );
        if (done.length) engine.retryFonts(done);
      }),
    [engine],
  );

  const actions = useMemo<EditorActions>(
    () => ({
      engine,
      seek: (seconds) => {
        const time = Math.max(0, seconds);
        useEditor.getState().setPlayhead(time);
        engine.seek(time);
      },
      togglePlay: () => {
        if (engine.playing) engine.pause();
        else engine.play();
        useEditor.getState().setPlaying(engine.playing);
      },
      pause: () => {
        engine.pause();
        useEditor.getState().setPlaying(false);
      },
      apply: (operations, label) => runtime.videos.apply(operations, label),
      undo: (target) => runtime.videos.undo(target),
    }),
    [engine, runtime],
  );

  // On switching videos: selection and playhead reset to zero (kept when the same video moves between Home and Space, product design §5.1). The right panel lands on the transcript; an empty timeline lands on the video (design editor.jsx landing). When the result page of a short-form cut opens a clip and the banner returns to the source, it lands on the AI tools tab (`setPanelLanding`). A child video opened without a panel lands on the transcript with the timeline open (product design §5.10, `landingPanel`).
  const videoId = video?.videoId ?? null;
  useEffect(() => {
    if (!videoId) return;
    const opened = useVideo.getState().video?.state?.video;
    const root = opened ? rootSequence(opened) : null;
    const editor = useEditor.getState();
    const fresh = editor.videoId !== videoId;
    const landing = landingPanel<PanelTab>({
      handoff: takePanelLanding(videoId),
      child: !!readDerivation(opened?.documents),
      hasItems: root ? root.items.length > 0 : undefined,
    });
    editor.attach(videoId, landing.tab);
    if (fresh && landing.cut) useTranscriptMode.getState().setMode('cut');
    engine.seek(useEditor.getState().playhead);
  }, [videoId, engine]);

  // After a short-form cut finishes and a child video is switched out: with the parent open, the right side flips to the result page (the web has no AI tools tab).
  useShortsLanding(videoId, runtime.host.platform !== 'web');

  const assets = snapshot?.assets ?? null;
  const documents = snapshot?.documents ?? null;
  useEffect(() => {
    if (shown && assets) engine.setVideo(shown, assets, documents ?? {});
  }, [engine, shown, assets, documents]);

  // Clips that are deleted, or changed by someone else, are removed from the selection.
  useEffect(() => {
    if (!sequence) return;
    const { selection, select } = useEditor.getState();
    const ids = new Set(sequence.items.map((item) => item.id));
    if (selection.some((id) => !ids.has(id))) select(selection.filter((id) => ids.has(id)));
  }, [sequence]);

  // Command failed: the engine's explanation is shown as-is (it is already in Chinese) and not silently swallowed (product design §5.5).
  const commandError = video?.commandError ?? null;
  useEffect(() => {
    if (!commandError) return;
    ToastQueue.negative(E.editFailed(commandError.message), { timeout: 6000 });
    runtime.videos.clearError();
  }, [commandError, runtime]);

  useEditorKeys(rootRef, sequence, actions, timeline);
  useNudgeFlush(actions);

  if (!video) return null;
  return (
    <EditorContext.Provider value={actions}>
      <div ref={rootRef} className={editor} tabIndex={-1} data-editor-root>
        <VideoBar video={video} sequence={sequence} active={active} />
        {snapshot && video.videoId ? <ShortsChildBanner videoId={video.videoId} documents={snapshot.documents} /> : null}
        {sequence && shown && snapshot ? (
          <div className={`flex min-h-0 min-w-0 flex-1 gap-4 ${inSession ? '' : 'p-3'}`}>
            <SidePanel sequence={shown} assets={snapshot.assets} documents={snapshot.documents} />
            <div className="flex min-h-0 min-w-[320px] flex-1 basis-80 flex-col">
              <FontBar videoId={video.videoId} />
              <Preview videoId={video.videoId} sequence={shown} assets={snapshot.assets} documents={snapshot.documents} />
              <StageLiveCaptions videoId={video.videoId} sequence={shown} documents={snapshot.documents} />
              <TimelineSplitter />
              <TimelineCard
                videoId={video.videoId}
                sequence={sequence}
                assets={snapshot.assets}
                documents={snapshot.documents}
                height={timelineHeight}
                handle={timeline}
              />
            </div>
            <InspectorColumn sequence={shown} assets={snapshot.assets} documents={snapshot.documents} active={active} />
            {video.videoId ? <SoundtrackBed videoId={video.videoId} sequence={sequence} assets={snapshot.assets} /> : null}
            <VideoSettingsDialog sequence={shown} assets={snapshot.assets} />
          </div>
        ) : video.status === 'error' ? (
          <div className={centered}>
            <IllustratedMessage size="S">
              <Heading>{E.cantOpen}</Heading>
              <Content>{video.error}</Content>
            </IllustratedMessage>
            <Button variant="secondary" onPress={() => runtime.videos.open(video.target)}>
              {E.retry}
            </Button>
          </div>
        ) : (
          <div className={centered}>
            <ProgressCircle isIndeterminate aria-label={E.openingAria} />
            <span>{E.opening}</span>
          </div>
        )}
      </div>
      <ShortcutSheet />
    </EditorContext.Provider>
  );
}

/** The drag bar between preview and timeline: dragging up makes the timeline taller. */
function TimelineSplitter() {
  const height = useEditor((s) => s.timelineHeight);
  const setHeight = useEditor((s) => s.setTimelineHeight);
  const start = useRef<{ y: number; height: number } | null>(null);
  const resize = (clientY: number) => {
    if (!start.current) return;
    const max = Math.max(TIMELINE_HEIGHT_MIN, window.innerHeight - 360);
    setHeight(Math.min(max, start.current.height - (clientY - start.current.y)));
  };
  return (
    <div
      className="group/split relative flex h-3 shrink-0 cursor-row-resize touch-none items-center justify-center"
      role="separator"
      aria-orientation="horizontal"
      aria-label={E.resizeTimeline}
      aria-valuenow={height}
      onPointerDown={(event: ReactPointerEvent<HTMLDivElement>) => {
        start.current = { y: event.clientY, height };
        event.currentTarget.setPointerCapture(event.pointerId);
      }}
      onPointerMove={(event) => {
        if (!start.current) return;
        if (event.buttons === 0) start.current = null;
        else resize(event.clientY);
      }}
      onPointerUp={(event) => {
        // Count where it was let go too: fast drags coalesce pointermove events.
        resize(event.clientY);
        start.current = null;
      }}
      onLostPointerCapture={() => {
        start.current = null;
      }}>
      <span aria-hidden className="h-1 w-10 rounded-full bg-white/15 opacity-0 transition-opacity duration-150 group-hover/split:opacity-100" />
    </div>
  );
}

/** Keys typed in text fields, dialogs and menus do not belong to the editor. The session input and the editor are on the same screen, so this must hold. */
function belongsToEditor(event: KeyboardEvent, root: HTMLElement): boolean {
  const target = event.target as HTMLElement | null;
  if (!target) return false;
  // The header actions and the inspector may be portalled into the session layout; they still belong to the editor.
  if (target !== document.body && !root.contains(target) && !target.closest('[data-editor-scope]')) return false;
  if (target.closest('input, textarea, select, [contenteditable=""], [contenteditable="true"], [role="textbox"]')) return false;
  if (document.querySelector('[role="dialog"], [role="menu"], [role="listbox"]')) return false;
  // When focus is on a button, Space and Enter are left to the button itself.
  if ((event.key === ' ' || event.key === 'Enter') && target.closest('button, [role="button"], a, [role="tab"], [role="radio"]'))
    return false;
  return true;
}

const MAC = typeof navigator !== 'undefined' && /Mac/.test(navigator.platform);
const MODIFIER_KEYS = new Set(['Shift', 'Control', 'Alt', 'Meta', 'CapsLock']);
/** How many seconds ←/→ and J/L jump during playback (prototype editor-keys: keys borrowed from fullscreen). */
const JUMP_PLAYING = 5;
const JUMP_JL = 10;

/** Letter keys: match by character first (layouts such as Dvorak work by character). If no character matches (input method, symbols produced by ⌥ combinations), fall back to the physical key. */
function letterOf(event: KeyboardEvent): string {
  const key = event.key.length === 1 ? event.key.toLowerCase() : '';
  if (/^[a-z]$/.test(key)) return key;
  if (/^Key[A-Z]$/.test(event.code)) return event.code.slice(3).toLowerCase();
  return key;
}

/** Some text is selected on the page (not in an input): ⌘C is left to the system to copy that text. */
function hasTextSelection(): boolean {
  const text = window.getSelection();
  return !!text && !text.isCollapsed && text.toString().trim() !== '';
}

/**
 * Editor shortcuts (prototype editor-keys.jsx:170-296; list in shortcut-sheet). Commands are shared with the context menu (timeline-commands).
 * Letter keys never take ⇧ (⇧⌘B etc. belong to the shell). During playback, ↑/↓ and M adjust the preview's listening volume (model/preview-volume, not stored in the video). F enters fullscreen playback (fullscreen-player.tsx). In fullscreen, the keyboard is given entirely to the fullscreen player (it handles its own keys in the capture phase), and nothing is handled here.
 *
 * Stage arrow keys: when the stage has already handled them (`defaultPrevented`, because it moved the selected element), ←/→ do not move the playhead. When the stage has focus but nothing is selected, frame-stepping proceeds as usual. ⌥←/→ is always time nudging (prototype: ⌥←/→ is reserved for time nudging).
 */
function useEditorKeys(
  rootRef: { current: HTMLDivElement | null },
  sequence: Sequence | null,
  actions: EditorActions,
  timeline: { current: TimelineHandle | null },
) {
  const latest = useRef(sequence);
  latest.current = sequence;
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      const root = rootRef.current;
      const seq = latest.current;
      if (!root || !seq || !belongsToEditor(event, root)) return;
      // In fullscreen playback the keyboard belongs to the fullscreen player (prototype editor-keys: the yield added in round 222). Even editing keys such as ⌘Z and Delete are not handled, because a timeline that cannot be seen should not be edited.
      if (useEditor.getState().fullscreen) return;
      const mod = MAC ? event.metaKey : event.ctrlKey;
      const letter = letterOf(event);
      const arrow = event.key === 'ArrowLeft' || event.key === 'ArrowRight';
      const direction = event.key === 'ArrowLeft' ? -1 : 1;
      const editor = useEditor.getState();
      const video = useVideo.getState().video;
      const editable = canEdit(video);
      const fps = seq.fps;
      const perSecond = Math.round(fps.num / fps.den);
      const duration = durationSeconds(seq);
      const handled = () => {
        event.preventDefault();
        event.stopPropagation();
      };
      const jump = (seconds: number) => actions.seek(Math.min(duration, Math.max(0, useEditor.getState().playhead + seconds)));

      // ⌘Z / ⇧⌘Z: an uncommitted nudge is discarded (undo), or committed first (a new edit clears redo).
      if (mod && !event.altKey && (letter === 'z' || letter === 'y')) {
        handled();
        const redo = letter === 'y' || event.shiftKey;
        if (!editable) return;
        if (!redo && dropNudge()) return;
        if (editor.nudge) {
          if (redo) return flushNudge(actions);
          return void actions.undo('undo');
        }
        if (redo ? !video?.undo.redo : !video?.undo.undo) {
          ToastQueue.neutral(redo ? E.nothingToRedo : E.nothingToUndo, { timeout: 2500 });
          return;
        }
        void actions.undo(redo ? 'redo' : 'undo');
        return;
      }
      // For keys other than consecutive ⌥←/→, commit any accumulated nudge first.
      if (!(arrow && event.altKey && !mod) && !MODIFIER_KEYS.has(event.key)) flushNudge(actions);

      // Zoom: ⌘= / ⌘− / ⌘0 (100%) and ⌥⌘1–4, the same set of actions as the zoom menu on the transport bar (the timeline's handle.zoom).
      const zoom = zoomKey(event, mod);
      if (zoom) return (handled(), timeline.current?.zoom(zoom));

      if (mod && !event.altKey) {
        if (event.shiftKey) return;
        if (event.key === 'ArrowUp' || event.key === 'ArrowDown') {
          // ⌘↑ / ⌘↓: move the selected canvas element forward or backward one layer (the two rows of “层级” (Layer order) in the canvas toolbar).
          if (arrangeSelection(actions, event.key === 'ArrowUp' ? 'forward' : 'backward')) handled();
          return;
        }
        switch (letter) {
          case 'c':
            if (hasTextSelection()) return;
            handled();
            copySelection();
            return;
          case 'x':
            handled();
            void cutSelection(actions);
            return;
          case 'v':
            handled();
            void pasteClipboard(actions);
            return;
          case 'd':
            handled();
            void duplicateSelection(actions);
            return;
          case 'a':
            handled();
            selectAtPlayhead();
            return;
          case 'b':
            handled();
            splitAtPlayhead(actions);
            return;
        }
        return;
      }
      if (event.ctrlKey || event.metaKey) return;

      if (event.key === '?') {
        handled();
        editor.setShortcutsOpen(true);
        return;
      }
      if (arrow) {
        if (event.defaultPrevented) return;
        if (event.altKey) {
          // ⌥←/→ nudges the selected clip one frame (⇧ for one second). The nudges are merged into one edit once the user stops.
          if (!editor.selection.length) return;
          handled();
          nudgeTime(actions, direction * (event.shiftKey ? perSecond : 1));
          return;
        }
        // When the stage (stage-objects) can move the selected element, it has already called preventDefault (React's listeners run before window). When nothing is selected, step frames as usual.
        handled();
        if (editor.playing && !event.shiftKey) return jump(direction * JUMP_PLAYING);
        const frame = frameAt(editor.playhead, fps);
        const step = (event.shiftKey ? perSecond : 1) * direction;
        actions.seek(Math.min(duration, (Math.max(0, frame + step) * fps.den) / fps.num));
        return;
      }
      if ((event.key === 'ArrowUp' || event.key === 'ArrowDown') && !event.altKey) {
        // During playback, adjust volume with the fullscreen player's keys. When the stage moved a selected element (defaultPrevented), yield to it; when stopped, do not handle it.
        if (event.defaultPrevented || !editor.playing) return;
        handled();
        const before = monitorLevel(actions.engine.monitor);
        setMonitor(actions, before, stepMonitor(before, event.key === 'ArrowUp' ? 1 : -1));
        return;
      }
      if (event.key === ' ') {
        handled();
        actions.togglePlay();
        return;
      }
      if (!event.altKey && !event.shiftKey && (letter === 'k' || letter === 'j' || letter === 'l')) {
        handled();
        if (letter === 'k') actions.togglePlay();
        else jump(letter === 'j' ? -JUMP_JL : JUMP_JL);
        return;
      }
      if (!event.altKey && letter === 's') {
        handled();
        splitAtPlayhead(actions);
        return;
      }
      if (!event.altKey && !event.shiftKey && letter === 'm') {
        handled();
        const before = monitorLevel(actions.engine.monitor);
        setMonitor(actions, before, toggleMute(before));
        return;
      }
      if (!event.altKey && !event.shiftKey && letter === 'f') {
        // With one canvas item selected, F is “移到最前” (Bring to front). With nothing selected, it enters fullscreen playback, which must be requested within this key press (browsers honor only user gestures).
        // Exit is handled by the fullscreen player (same key).
        handled();
        if (arrangeSelection(actions, 'front')) return;
        enterPreviewFullscreen(root.querySelector<HTMLElement>('[data-preview-stage]'));
        return;
      }
      if (!event.altKey && !event.shiftKey && letter === 'b') {
        // B: move the selected canvas element to the back.
        if (arrangeSelection(actions, 'back')) handled();
        return;
      }
      switch (event.key) {
        case 'Delete':
        case 'Backspace':
          handled();
          // ⇧Delete: remove the time the selected clip covers from all tracks, and shift later content forward. Delete removes only the clip (if all tracks are empty over that span, it closes up).
          void (event.shiftKey ? removeSelectionSpan(actions) : deleteSelection(actions));
          return;
        case 'Escape':
          // Menus, dialogs and drags each handle Esc first (belongsToEditor, the timeline's capture listener). By this point, only deselection remains.
          if (!editor.selection.length) return;
          handled();
          editor.select([]);
          return;
        case 'Home':
          handled();
          actions.seek(0);
          return;
        case 'End':
          handled();
          actions.seek(duration);
          return;
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [rootRef, actions, timeline]);
}

/** The previous volume toast: dismiss it first when pressed repeatedly, so they do not stack up. */
let closeVolumeToast: (() => void) | null = null;

/** Changes the preview's listening volume; the toast shows the current level. */
function setMonitor(actions: EditorActions, before: MonitorLevel, next: MonitorLevel): void {
  actions.engine.setMonitor(monitorGain(next));
  closeVolumeToast?.();
  const text = next.muted ? PREVIEW_KEYS_COPY.muted : before.muted ? PREVIEW_KEYS_COPY.unmuted(next.volume) : PREVIEW_KEYS_COPY.volume(next.volume);
  closeVolumeToast = ToastQueue.neutral(text, { timeout: 5000 });
}

/** Accumulated ⌥←/→ nudge: committed when the selection changes, when the user clicks elsewhere, when the window loses focus, or when the editor is left. */
function useNudgeFlush(actions: EditorActions) {
  useEffect(() => {
    const flush = () => flushNudge(actions);
    const stop = useEditor.subscribe((state, previous) => {
      if (state.selection !== previous.selection && state.nudge && !state.nudge.committing) flush();
    });
    window.addEventListener('pointerdown', flush, true);
    window.addEventListener('blur', flush);
    return () => {
      stop();
      window.removeEventListener('pointerdown', flush, true);
      window.removeEventListener('blur', flush);
      flush();
    };
  }, [actions]);
}
