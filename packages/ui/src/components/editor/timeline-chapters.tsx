import { useEffect, useMemo, useRef, useState, type PointerEvent as ReactPointerEvent, type ReactNode } from 'react';
import { sequenceDurationFrames, type Id, type Sequence } from '@cuccut/protocol';
import {
  ActionButton,
  Button,
  Header,
  Heading,
  Menu,
  MenuItem,
  MenuSection,
  MenuTrigger,
  Popover,
  Text,
  TextField,
  ToastQueue,
  Tooltip,
  TooltipTrigger,
} from '@react-spectrum/s2';
import Add from '@react-spectrum/s2/icons/Add';
import DeleteIcon from '@react-spectrum/s2/icons/Delete';
import Edit from '@react-spectrum/s2/icons/Edit';
import { style } from '@react-spectrum/s2/style' with { type: 'macro' };
import { Pressable } from 'react-aria-components';
import {
  CHAPTER_TITLE_MAX,
  addChapterRefusal,
  bandSegments,
  defaultChapterTitle,
  sequenceChapters,
  startBounds,
  type BandSegment,
  type ChapterSpan,
} from '../../model/chapters.ts';
import { durationSeconds, formatTimecode, frameAt } from '../../model/editor.ts';
import { formatClock } from '../../model/format.ts';
import { useEditor } from '../../state/editor-store.ts';
import { canEdit, useVideo } from '../../state/video-store.ts';
import { addChapter, moveChapter, removeChapter, renameChapter } from './chapter-commands.ts';
import { CHAPTER_COPY as C } from './chapter-copy.ts';
import { useEditorActions } from './editor-context.tsx';

/**
 * Chapter bar at the top of the timeline (design timeline.jsx `ChapterBand`, Mac ChapterScrubberView style): the full bar width is the whole program and does not scale with zoom;
 * one segment per chapter, each filled with playback progress; it thickens on hover and shows the start and end times and the title; clicking a segment jumps to the start of that chapter, and clicking an empty gap positions by location.
 * Pressing clears the timeline selection (same rule as the ruler and empty track area).
 *
 * The design's chapter bar is view-only; here editing is added according to the contract (`upsertChapter` / `removeChapter`), and each step is one undoable transaction:
 * - Each chapter's start has a 4px drag zone on each side; dragging changes the start (clamped between the previous and next chapters; within 6px it snaps to the playhead; Esc cancels);
 * - Right-click: add a chapter at the playhead, rename it, or delete this chapter;
 * - The “＋” at the right end of the bar adds a chapter at the playhead. Both adding and renaming enter the name in the same small popover.
 * When the video is read-only (importing, or being changed elsewhere), all editing entry points are greyed out, while click-to-seek still works.
 */

const BAND_H = 24;
/** Gap between segments (design gap 4px): each segment gives up 2px at its inner boundary. */
const SEAM = 2;
/** Half-width of the drag zone (pixels). */
const EDGE_PX = 4;
/** Distance (pixels) within which a dragged start snaps to the playhead. */
const SNAP_PX = 6;
/** Moving more than this many pixels after pressing counts as a drag; otherwise it is treated as a click. */
const DRAG_PX = 3;
const BUBBLE_W = 200;
const TOAST_MS = 2500;

const band = style({
  position: 'relative',
  zIndex: 5,
  display: 'flex',
  alignItems: 'center',
  gap: 4,
  height: BAND_H,
  flexShrink: 0,
  paddingStart: '[14px]',
  paddingEnd: 4,
  backgroundColor: 'gray-25',
  userSelect: 'none',
});
const bar = style({ position: 'relative', display: 'flex', alignItems: 'center', flexGrow: 1, minWidth: 0, height: BAND_H });
const track = style({ position: 'relative', width: 'full', height: { default: 5, isTall: 7 }, transition: 'all' });
const seg = style({
  position: 'absolute',
  top: 0,
  bottom: 0,
  borderRadius: 'full',
  overflow: 'hidden',
  cursor: 'pointer',
  backgroundColor: { default: 'gray-300', isGap: 'gray-200' },
});
const fill = style({ position: 'absolute', top: 0, bottom: 0, insetStart: 0, backgroundColor: 'blue-900' });
const edge = style({
  position: 'absolute',
  top: 0,
  bottom: 0,
  zIndex: 1,
  width: EDGE_PX * 2,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  cursor: 'ew-resize',
});
const edgeTick = style({ width: 2, height: 13, borderRadius: 'full', backgroundColor: { default: 'gray-600', isSnapped: 'blue-900' } });
const bubble = style({
  position: 'absolute',
  top: BAND_H,
  zIndex: 1,
  boxSizing: 'border-box',
  width: BUBBLE_W,
  paddingX: 8,
  paddingY: 4,
  borderRadius: 'default',
  backgroundColor: 'gray-25',
  borderWidth: 1,
  borderStyle: 'solid',
  borderColor: 'gray-200',
  boxShadow: 'elevated',
  pointerEvents: 'none',
  display: 'flex',
  flexDirection: 'column',
  gap: 2,
});
const bubbleTime = style({ font: 'code-xs', color: 'gray-700', whiteSpace: 'nowrap' });
const bubbleTitle = style({ font: 'ui-xs', color: 'gray-900', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' });
const anchor = style({ position: 'fixed', width: 0, height: 0, pointerEvents: 'none', outlineStyle: 'none' });
const form = style({ display: 'flex', flexDirection: 'column', gap: 16, width: 260 });
const formButtons = style({ display: 'flex', justifyContent: 'end', gap: 8 });

interface Drag {
  chapterId: Id;
  /** Index into `sequenceChapters` (chapters do not change during a drag). */
  index: number;
  x0: number;
  frame: number;
  moved: boolean;
  snapped: boolean;
}

/** Where the right-click happened: which chapter (null for an empty gap), and the pointer position (viewport coordinates). */
interface MenuTarget {
  chapterId: Id | null;
  x: number;
  y: number;
}

/** Naming popover: for adding (at which frame) or renaming (which chapter), and its anchor position (viewport coordinates). */
type FormTarget = { mode: 'add'; frame: number; x: number; y: number } | { mode: 'rename'; chapterId: Id; x: number; y: number };

export function TimelineChapters({ sequence }: { sequence: Sequence }) {
  const actions = useEditorActions();
  const editable = useVideo((s) => canEdit(s.video));
  const fps = sequence.fps;
  const perSecond = fps.num / fps.den;
  const duration = durationSeconds(sequence);
  const totalFrames = sequenceDurationFrames(sequence);
  const chapters = useMemo(() => sequenceChapters(sequence), [sequence]);
  const [drag, setDragState] = useState<Drag | null>(null);
  // Pointer events can arrive faster than redraws: gestures are tracked by ref, and state is only used to trigger redraws.
  const dragRef = useRef<Drag | null>(null);
  const setDrag = (next: Drag | null) => {
    dragRef.current = next;
    setDragState(next);
  };
  // While dragging, rearrange by the position dragged to (same as the committed result: the previous chapter stretches or shrinks along with it).
  const shown = useMemo(
    () =>
      drag?.moved
        ? sequenceChapters({ ...sequence, markers: sequence.markers.map((m) => (m.id === drag.chapterId ? { ...m, frame: drag.frame } : m)) })
        : chapters,
    [drag, sequence, chapters],
  );
  const segments = useMemo(() => bandSegments(shown, duration), [shown, duration]);
  const [hover, setHover] = useState<string | null>(null);
  const [hoverEdge, setHoverEdge] = useState<Id | null>(null);
  const [inside, setInside] = useState(false);
  const [menu, setMenu] = useState<MenuTarget | null>(null);
  const [target, setTarget] = useState<FormTarget | null>(null);
  const [draft, setDraft] = useState('');
  const rootRef = useRef<HTMLDivElement>(null);
  const barRef = useRef<HTMLDivElement>(null);
  const addRef = useRef<HTMLSpanElement>(null);
  const anchorRef = useRef<HTMLSpanElement>(null);

  const pct = (seconds: number) => (duration > 0 ? (seconds / duration) * 100 : 0);
  const timeAt = (clientX: number) => {
    const rect = barRef.current?.getBoundingClientRect();
    if (!rect || rect.width <= 0) return 0;
    return Math.min(1, Math.max(0, (clientX - rect.left) / rect.width)) * duration;
  };

  // ---- Drag start ----

  const onEdgeDown = (event: ReactPointerEvent, chapter: ChapterSpan) => {
    if (event.button !== 0) return;
    event.stopPropagation();
    event.preventDefault();
    useEditor.getState().select([]);
    const index = chapters.findIndex((c) => c.id === chapter.id);
    setDrag({ chapterId: chapter.id, index, x0: event.clientX, frame: chapter.startFrame, moved: false, snapped: false });
  };

  const onDragMove = (event: PointerEvent) => {
    const current = dragRef.current;
    if (!current) return;
    if (!current.moved && Math.abs(event.clientX - current.x0) < DRAG_PX) return;
    const width = barRef.current?.getBoundingClientRect().width ?? 0;
    const pxPerFrame = totalFrames > 0 ? width / totalFrames : 0;
    const playheadFrame = Math.round(useEditor.getState().playhead * perSecond);
    let frame = Math.round(timeAt(event.clientX) * perSecond);
    if (pxPerFrame > 0 && Math.abs(frame - playheadFrame) * pxPerFrame <= SNAP_PX) frame = playheadFrame;
    const bounds = startBounds(chapters, current.index, totalFrames);
    frame = Math.min(bounds.max, Math.max(bounds.min, frame));
    setDrag({ ...current, moved: true, frame, snapped: frame === playheadFrame });
  };

  const onDragEnd = () => {
    const done = dragRef.current;
    setDrag(null);
    const chapter = done ? chapters[done.index] : undefined;
    if (!done || !chapter) return;
    // If it was not dragged apart, it was just a click: jump to the start of this chapter.
    if (!done.moved) actions.seek(chapter.start);
    else void moveChapter(actions, sequence, chapter, done.frame);
  };

  const handlers = useRef({ move: onDragMove, end: onDragEnd });
  handlers.current = { move: onDragMove, end: onDragEnd };
  const dragging = drag !== null;
  useEffect(() => {
    if (!dragging) return;
    const onMove = (event: PointerEvent) => {
      if (event.buttons === 0) setDrag(null);
      else handlers.current.move(event);
    };
    const onUp = (event: PointerEvent) => {
      handlers.current.move(event);
      handlers.current.end();
    };
    const onCancel = () => setDrag(null);
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      event.preventDefault();
      event.stopPropagation();
      setDrag(null);
    };
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
    window.addEventListener('pointercancel', onCancel);
    window.addEventListener('keydown', onKey, true);
    return () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
      window.removeEventListener('pointercancel', onCancel);
      window.removeEventListener('keydown', onKey, true);
    };
  }, [dragging]);

  // ---- Add, rename, delete ----

  const openAdd = (x: number, y: number) => {
    const frame = frameAt(useEditor.getState().playhead, fps);
    const refusal = addChapterRefusal(sequence, chapters, frame);
    if (refusal) {
      ToastQueue.neutral(C.refusal[refusal], { timeout: TOAST_MS });
      return;
    }
    actions.pause();
    setDraft(defaultChapterTitle(chapters, frame));
    setTarget({ mode: 'add', frame, x, y });
  };

  const openRename = (chapter: ChapterSpan, x: number, y: number) => {
    setDraft(chapter.label.trim() || chapter.title);
    setTarget({ mode: 'rename', chapterId: chapter.id, x, y });
  };

  const submit = () => {
    const done = target;
    setTarget(null);
    if (!done || !draft.trim()) return;
    if (done.mode === 'add') {
      void addChapter(actions, sequence, done.frame, draft);
      return;
    }
    const chapter = chapters.find((c) => c.id === done.chapterId);
    if (chapter) void renameChapter(actions, sequence, chapter, draft);
  };

  const onAddPress = () => {
    const rect = addRef.current?.getBoundingClientRect();
    openAdd(rect ? rect.left + rect.width / 2 : 0, rect ? rect.bottom : 0);
  };

  // ---- Floating start/end and title: the hovered segment, or the chapter being dragged ----

  let tip: { at: number; time: string; title: string } | null = null;
  if (drag?.moved) {
    const c = shown.find((x) => x.id === drag.chapterId);
    if (c) tip = { at: c.start, time: formatTimecode(c.start, fps), title: c.title };
  } else if (hover !== null && !drag) {
    const s = segments.find((x) => x.key === hover);
    if (s)
      tip = {
        at: (s.start + s.end) / 2,
        time: `${formatClock(s.start)}–${formatClock(s.end)}`,
        title: s.chapter?.title ?? (chapters.length ? C.gap : C.noChapters),
      };
  }
  let tipLeft = 0;
  if (tip && barRef.current && rootRef.current) {
    const x = barRef.current.offsetLeft + (pct(tip.at) / 100) * barRef.current.clientWidth;
    tipLeft = Math.max(8, Math.min(rootRef.current.clientWidth - BUBBLE_W - 8, x - BUBBLE_W / 2));
  }

  const menuChapter = menu?.chapterId ? (chapters.find((c) => c.id === menu.chapterId) ?? null) : null;

  return (
    <div
      ref={rootRef}
      className={band}
      aria-label={C.band}
      onPointerEnter={() => setInside(true)}
      onPointerLeave={() => {
        setInside(false);
        setHover(null);
        setHoverEdge(null);
      }}
      onPointerDown={(event) => {
        if (event.button === 0) useEditor.getState().select([]);
      }}>
      <div
        ref={barRef}
        className={bar}
        onContextMenu={(event) => {
          event.preventDefault();
          const t = timeAt(event.clientX);
          const hit = segments.find((s) => t >= s.start && t <= s.end);
          setMenu({ chapterId: hit?.chapter?.id ?? null, x: event.clientX, y: event.clientY });
        }}>
        <div className={track({ isTall: inside || dragging })}>
          {segments.map((s) => (
            <Segment
              key={s.key}
              segment={s}
              left={pct(s.start)}
              width={pct(s.end) - pct(s.start)}
              insetStart={s.start > 0 ? SEAM : 0}
              insetEnd={s.end < duration ? SEAM : 0}
              onEnter={() => setHover(s.key)}
              onPress={(clientX) => actions.seek(s.chapter ? s.chapter.start : timeAt(clientX))}
            />
          ))}
        </div>
        {editable
          ? shown
              .filter((c) => c.endFrame > c.startFrame)
              .map((c) => (
                <div
                  key={c.id}
                  className={edge}
                  style={{ left: `calc(${pct(c.start)}% - ${EDGE_PX}px)` }}
                  title={C.dragHint}
                  onPointerEnter={() => setHoverEdge(c.id)}
                  onPointerLeave={() => setHoverEdge((id) => (id === c.id ? null : id))}
                  onPointerDown={(event) => onEdgeDown(event, c)}>
                  {hoverEdge === c.id || drag?.chapterId === c.id ? (
                    <span className={edgeTick({ isSnapped: !!drag?.moved && drag.chapterId === c.id && drag.snapped })} />
                  ) : null}
                </div>
              ))
          : null}
      </div>
      <span ref={addRef}>
        <Tip label={C.add}>
          <ActionButton isQuiet size="XS" aria-label={C.add} isDisabled={!editable} onPress={onAddPress}>
            <Add />
          </ActionButton>
        </Tip>
      </span>
      {tip ? (
        <div className={bubble} style={{ left: tipLeft }}>
          <span className={`${bubbleTime} cc-tabular`}>{tip.time}</span>
          <span className={bubbleTitle}>{tip.title}</span>
        </div>
      ) : null}

      <ChapterMenu
        target={menu}
        chapter={menuChapter}
        editable={editable}
        addRefusal={menu ? addChapterRefusal(sequence, chapters, frameAt(useEditor.getState().playhead, fps)) : null}
        onClose={() => setMenu(null)}
        onAction={(key) => {
          const at = menu;
          setMenu(null);
          if (!at) return;
          if (key === 'add') openAdd(at.x, at.y);
          else if (key === 'rename' && menuChapter) openRename(menuChapter, at.x, at.y);
          else if (key === 'remove' && menuChapter) void removeChapter(actions, sequence, menuChapter);
        }}
      />

      <span ref={anchorRef} className={anchor} style={{ left: target?.x ?? 0, top: target?.y ?? 0 }} />
      <Popover
        triggerRef={anchorRef}
        isOpen={!!target}
        onOpenChange={(open) => {
          if (!open) setTarget(null);
        }}
        placement="bottom"
        padding="default"
        aria-label={target?.mode === 'rename' ? C.renameTitle : C.addTitle}>
        <form
          className={form}
          onSubmit={(event) => {
            event.preventDefault();
            submit();
          }}>
          <TextField
            label={target?.mode === 'rename' ? C.renameTitle : C.addTitle}
            autoFocus
            value={draft}
            onChange={setDraft}
            maxLength={CHAPTER_TITLE_MAX}
            description={target?.mode === 'add' ? C.addAt(formatTimecode(target.frame / perSecond, fps)) : undefined}
            errorMessage={C.refusal.blank}
            isInvalid={!draft.trim()}
          />
          <div className={formButtons}>
            <Button variant="secondary" onPress={() => setTarget(null)}>
              {C.cancel}
            </Button>
            <Button variant="accent" type="submit" isDisabled={!draft.trim()}>
              {target?.mode === 'rename' ? C.confirmRename : C.confirmAdd}
            </Button>
          </div>
        </form>
      </Popover>
    </div>
  );
}

/** A segment: a chapter or an empty gap, filled with playback progress. Only a click (not a drag) positions the playhead. */
function Segment({
  segment,
  left,
  width,
  insetStart,
  insetEnd,
  onEnter,
  onPress,
}: {
  segment: BandSegment;
  left: number;
  width: number;
  insetStart: number;
  insetEnd: number;
  onEnter(): void;
  onPress(clientX: number): void;
}) {
  return (
    <div
      className={seg({ isGap: !segment.chapter })}
      style={{ left: `calc(${left}% + ${insetStart}px)`, width: `calc(${width}% - ${insetStart + insetEnd}px)` }}
      onPointerEnter={onEnter}
      onClick={(event) => onPress(event.clientX)}>
      <SegmentFill start={segment.start} end={segment.end} />
    </div>
  );
}

/** Playback progress subscribes separately: during playback only the progress bar is redrawn. */
function SegmentFill({ start, end }: { start: number; end: number }) {
  const done = useEditor((s) => (end > start ? Math.min(1, Math.max(0, (s.playhead - start) / (end - start))) : 0));
  return <div className={fill} style={{ width: `${done * 100}%` }} />;
}

/** Right-click menu for the chapter bar: add a chapter at the playhead; right-clicking on a chapter also offers rename and delete for that chapter. Opens at the pointer position (same as timeline-menu). */
function ChapterMenu({
  target,
  chapter,
  editable,
  addRefusal,
  onClose,
  onAction,
}: {
  target: MenuTarget | null;
  chapter: ChapterSpan | null;
  editable: boolean;
  addRefusal: keyof typeof C.refusal | null;
  onClose(): void;
  onAction(key: 'add' | 'rename' | 'remove'): void;
}) {
  // The fade-out on close still needs to draw the previous content.
  const last = useRef<{ target: MenuTarget; chapter: ChapterSpan | null; addRefusal: keyof typeof C.refusal | null } | null>(null);
  if (target) last.current = { target, chapter, addRefusal };
  const at = last.current;
  if (!at) return null;
  const label = at.chapter ? C.menuLabel(at.chapter.title) : C.gapMenuLabel;
  const disabled = editable ? (at.addRefusal ? ['add'] : []) : ['add', 'rename', 'remove'];
  return (
    <MenuTrigger
      trigger="contextMenu"
      isOpen={!!target}
      onOpenChange={(open) => {
        if (!open) onClose();
      }}>
      <Pressable>
        <span role="button" tabIndex={-1} aria-label={label} className={anchor} style={{ left: at.target.x, top: at.target.y }} />
      </Pressable>
      <Menu aria-label={label} disabledKeys={disabled} onAction={(key) => onAction(String(key) as 'add' | 'rename' | 'remove')}>
        <MenuSection>
          <Header>
            <Heading>{at.chapter ? at.chapter.title : C.gap}</Heading>
          </Header>
          <MenuItem id="add" textValue={C.add}>
            <Add />
            <Text slot="label">{C.add}</Text>
            {editable && at.addRefusal ? <Text slot="description">{C.refusal[at.addRefusal]}</Text> : null}
          </MenuItem>
        </MenuSection>
        {at.chapter ? (
          <MenuSection>
            <MenuItem id="rename" textValue={C.rename}>
              <Edit />
              <Text slot="label">{C.rename}</Text>
            </MenuItem>
            <MenuItem id="remove" textValue={C.remove}>
              <DeleteIcon />
              <Text slot="label">{C.remove}</Text>
            </MenuItem>
          </MenuSection>
        ) : null}
      </Menu>
    </MenuTrigger>
  );
}

function Tip({ label, children }: { label: string; children: ReactNode }) {
  return (
    <TooltipTrigger>
      {children}
      <Tooltip>{label}</Tooltip>
    </TooltipTrigger>
  );
}
