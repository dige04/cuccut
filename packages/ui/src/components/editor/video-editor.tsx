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
  // 属性页拖动中的值只叠给预览与属性页；时间线、快捷键与提交都按视频里的实际值。
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
        // 本机没有、字体目录里有的族按设置下载，下载好了再注入（§9.1）。
        runtimeFonts(downloadingResolve((params) => runtime.client.request('fonts.resolve', params))),
        // 在等兼容副本的媒体（卡住诊断分清在转换与在等媒体）：按当前打开的视频问媒体地址缓存。
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
  // 一个族变成已下载（不论是谁开始的下载）：预览之前报缺、问过的这个族再去要一次，画面自动换上。
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

  // 换了视频：选区与播放头归零（同一个视频在 Home 与 Space 之间切换时保持，产品设计 §5.1）；
  // 右侧面板落在文稿，时间线还是空的落在视频（设计稿 editor.jsx 的落点）。剪成短视频的结果页打开一支、横幅回到原片：
  // 落在 AI 工具 Tab（`setPanelLanding`）；没带面板打开的子视频落在文稿、剪辑打开（产品设计 §5.10，`landingPanel`）。
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

  // 剪成短视频跑完、切出了子视频：开着父视频时右侧翻到结果页（网页没有 AI 工具 Tab）。
  useShortsLanding(videoId, runtime.host.platform !== 'web');

  const assets = snapshot?.assets ?? null;
  const documents = snapshot?.documents ?? null;
  useEffect(() => {
    if (shown && assets) engine.setVideo(shown, assets, documents ?? {});
  }, [engine, shown, assets, documents]);

  // 删除或被别人改掉的片段从选区里拿掉。
  useEffect(() => {
    if (!sequence) return;
    const { selection, select } = useEditor.getState();
    const ids = new Set(sequence.items.map((item) => item.id));
    if (selection.some((id) => !ids.has(id))) select(selection.filter((id) => ids.has(id)));
  }, [sequence]);

  // 命令失败：引擎的说明原样给出（已经是中文），不静默吞掉（产品设计 §5.5）。
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

/** 预览与时间线之间的拖动条：往上拖时间线变高。 */
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

/** 文字输入、对话框与菜单里的按键不归编辑器；会话的输入框和编辑器在同一屏，这条必须守住。 */
function belongsToEditor(event: KeyboardEvent, root: HTMLElement): boolean {
  const target = event.target as HTMLElement | null;
  if (!target) return false;
  // The header actions and the inspector may be portalled into the session layout; they still belong to the editor.
  if (target !== document.body && !root.contains(target) && !target.closest('[data-editor-scope]')) return false;
  if (target.closest('input, textarea, select, [contenteditable=""], [contenteditable="true"], [role="textbox"]')) return false;
  if (document.querySelector('[role="dialog"], [role="menu"], [role="listbox"]')) return false;
  // 焦点在按钮上时，空格与回车留给按钮自己。
  if ((event.key === ' ' || event.key === 'Enter') && target.closest('button, [role="button"], a, [role="tab"], [role="radio"]'))
    return false;
  return true;
}

const MAC = typeof navigator !== 'undefined' && /Mac/.test(navigator.platform);
const MODIFIER_KEYS = new Set(['Shift', 'Control', 'Alt', 'Meta', 'CapsLock']);
/** 播放中 ←/→、J/L 一次跳多少秒（原型 editor-keys：借全屏的键）。 */
const JUMP_PLAYING = 5;
const JUMP_JL = 10;

/** 字母键：先认字符（Dvorak 等布局按字符走），认不出（输入法、⌥ 组合出的符号）再按物理键位。 */
function letterOf(event: KeyboardEvent): string {
  const key = event.key.length === 1 ? event.key.toLowerCase() : '';
  if (/^[a-z]$/.test(key)) return key;
  if (/^Key[A-Z]$/.test(event.code)) return event.code.slice(3).toLowerCase();
  return key;
}

/** 页面上选着一段文字（不在输入框里）：⌘C 留给系统复制这段文字。 */
function hasTextSelection(): boolean {
  const text = window.getSelection();
  return !!text && !text.isCollapsed && text.toString().trim() !== '';
}

/**
 * 编辑器快捷键（原型 editor-keys.jsx:170-296，清单见 shortcut-sheet）。命令与右键菜单同一份（timeline-commands）。
 * 字母键都不带 ⇧（⇧⌘B 等是外壳的键）。播放中 ↑/↓ 与 M 调预览的监听音量（model/preview-volume，不进视频）；
 * F 进全屏播放（fullscreen-player.tsx）；全屏时键盘整个让给全屏播放器（它在捕获阶段接自己的键），这里一个都不接。
 *
 * 舞台的方向键：舞台已经处理掉（`defaultPrevented`，它推动了选中元素）时，←/→ 不移播放头；舞台有焦点但没选中时照常逐帧；
 * ⌥←/→ 始终是时间微调（原型：⌥←/→ 让给时间微调）。
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
      // 全屏播放时键盘归全屏播放器（原型 editor-keys：第 222 轮的让位），连 ⌘Z、删除这类编辑键也不接——看不见的时间线不该被改。
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

      // ⌘Z / ⇧⌘Z：还没提交的微调直接丢掉（撤销）或先提交（新的修改清掉了重做）。
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
      // 连按 ⌥←/→ 之外的键：先把攒着的微调提交掉。
      if (!(arrow && event.altKey && !mod) && !MODIFIER_KEYS.has(event.key)) flushNudge(actions);

      // 缩放：⌘= / ⌘− / ⌘0（100%）与 ⌥⌘1–4，和走带的缩放菜单同一组动作（timeline 的 handle.zoom）。
      const zoom = zoomKey(event, mod);
      if (zoom) return (handled(), timeline.current?.zoom(zoom));

      if (mod && !event.altKey) {
        if (event.shiftKey) return;
        if (event.key === 'ArrowUp' || event.key === 'ArrowDown') {
          // ⌘↑ / ⌘↓：选中的画面元素前移 / 后移一层（画布工具条「层级」的两行）。
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
          // ⌥←/→ 把选中的片段挪一帧（⇧ 一秒），停手后合成一笔。
          if (!editor.selection.length) return;
          handled();
          nudgeTime(actions, direction * (event.shiftKey ? perSecond : 1));
          return;
        }
        // 舞台（stage-objects）推得动选中元素时已经 preventDefault（React 的监听先于 window）；没选中时照常走帧。
        handled();
        if (editor.playing && !event.shiftKey) return jump(direction * JUMP_PLAYING);
        const frame = frameAt(editor.playhead, fps);
        const step = (event.shiftKey ? perSecond : 1) * direction;
        actions.seek(Math.min(duration, (Math.max(0, frame + step) * fps.den) / fps.num));
        return;
      }
      if ((event.key === 'ArrowUp' || event.key === 'ArrowDown') && !event.altKey) {
        // 播放中借全屏播放器的键调音量；舞台推了选中元素（defaultPrevented）时让给它，停着时不接。
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
        // 选中画布上的一件时 F 是「移到最前」；没选中时进全屏播放，要在按键这一拍里请求（浏览器只认用户手势）。
        // 退出由全屏播放器那侧接（同一个键）。
        handled();
        if (arrangeSelection(actions, 'front')) return;
        enterPreviewFullscreen(root.querySelector<HTMLElement>('[data-preview-stage]'));
        return;
      }
      if (!event.altKey && !event.shiftKey && letter === 'b') {
        // B：选中的画面元素移到最后。
        if (arrangeSelection(actions, 'back')) handled();
        return;
      }
      switch (event.key) {
        case 'Delete':
        case 'Backspace':
          handled();
          // ⇧Delete：选中片段盖住的时间从所有轨道拿掉、后面前移；Delete 只删片段（所有轨道都空了的那段合拢）。
          void (event.shiftKey ? removeSelectionSpan(actions) : deleteSelection(actions));
          return;
        case 'Escape':
          // 菜单、对话框、拖动各自先接 Esc（belongsToEditor、时间线的捕获监听）；到这里只剩取消选中。
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

/** 上一条音量提示：连按时先收掉，不排成一串。 */
let closeVolumeToast: (() => void) | null = null;

/** 换预览的监听音量，提示一句现在多大。 */
function setMonitor(actions: EditorActions, before: MonitorLevel, next: MonitorLevel): void {
  actions.engine.setMonitor(monitorGain(next));
  closeVolumeToast?.();
  const text = next.muted ? PREVIEW_KEYS_COPY.muted : before.muted ? PREVIEW_KEYS_COPY.unmuted(next.volume) : PREVIEW_KEYS_COPY.volume(next.volume);
  closeVolumeToast = ToastQueue.neutral(text, { timeout: 5000 });
}

/** 攒着的 ⌥←/→ 微调：换了选区、点了别处、窗口失焦、离开编辑器时提交。 */
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
