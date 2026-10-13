import { useEffect, useMemo, useRef, useState, type KeyboardEvent, type MouseEvent, type PointerEvent, type ReactNode } from 'react';
import type { CaptionItem, DocumentRecord, Id, Localized, Place, Revision, Sequence, SequenceItem } from '@cuccut/protocol';
import { EditLabel } from '@cuccut/protocol/messages/ui';
import { style } from '@react-spectrum/s2/style' with { type: 'macro' };
import { STAGE_COPY } from '../../copy.ts';
import { captionKind } from '../../model/caption-tracks.ts';
import { applyDrafts, type ItemDraft } from '../../model/item-draft.ts';
import { DEFAULT_CAPTION_STYLE, captionStyleRoot } from '../../model/property-values.ts';
import {
  CAPTION_X,
  CAPTION_Y,
  captionBox,
  lineMoveStart,
  movedCaptionStyle,
  movedLineStyle,
  restackedRootY,
  stepCaptionMove,
  type CaptionMove,
  type CaptionMoveFrame,
} from '../../model/stage-caption-move.ts';
import {
  cropOperations,
  gestureOperations,
  gesturePatch,
  memberOf,
  membersOf,
  nudgeOperations,
  panGesture,
  resetRotation,
  stepGesture,
  type Gesture,
  type GestureFrame,
  type Modifiers,
  type StageEnv,
} from '../../model/stage-gesture.ts';
import { hitAt, isMainVideo, marqueeHits, marqueeSelection, visibleItems } from '../../model/stage-hit.ts';
import { showsShotChip } from '../../model/stage-shots.ts';
import {
  DEAD_ZONE,
  aabbOf,
  boundsOf,
  boxRect,
  cornerScales,
  isPannable,
  isPlaced,
  marqueeRect,
  nudgeDelta,
  pivotOf,
  poseContains,
  poseOf,
  resizeKindOf,
  type CanvasSize,
  type Guide,
  type Handle,
  type PlacedItem,
  type Point,
  type Pose,
  type Rect,
} from '../../model/stage-pose.ts';
import type { CaptionHit } from '../../render/render-planner.ts';
import { num, type Json } from '../../render/text-style.ts';
import { useRuntime } from '../../runtime/context.tsx';
import { useEditor } from '../../state/editor-store.ts';
import { canEdit, useVideo } from '../../state/video-store.ts';
import { openCaptionEditor } from './caption-open.ts';
import { previewCaptionStyle, saveCaptionStyle } from './caption-style-edit.ts';
import { draftedBody } from './draft-documents.ts';
import { useEditorActions } from './editor-context.tsx';
import type { PreviewEngine } from './preview-engine.ts';
import { GroupBox, Guides, ItemBox, Marquee, ThinBox, type View } from './stage-boxes.tsx';
import { StageCaptionToolbar } from './stage-caption-toolbar.tsx';
import { StageShotChip } from './stage-shot-chip.tsx';
import { StageTextEdit } from './stage-text-edit.tsx';
import { StageToolbar } from './stage-toolbar.tsx';

/**
 * Stage overlay (prototypes stage-objects.jsx, stage-marquee.jsx, stage.jsx): it sits over the preview canvas and handles pointer selection, multi-select, dragging, resizing, rotating, marquee selection, double-click text editing, and arrow-key nudging on the picture.
 *
 * - Point selection is computed from the frame plan's layer geometry (`stage-hit`): only what is visible can be hit. An unselected main video does not block selection; pressing and dragging on it does a marquee selection, and pressing without moving selects it on release. ⇧ / ⌘ click toggles multi-select (the main video does not join multi-select), and clicking empty space clears the selection.
 * - While dragging, only a draft is changed. A single item uses the store's draft (preview and properties page follow the pointer together). Multiple items use the engine's temporary override (the properties page does not follow); on release, one **single** transaction is committed with the final values computed from the starting state, and on failure it returns to the original values. A click that follows is swallowed only if a real drag happened.
 * - Captions have no `place`. Dragging one moves the horizontal center and anchor line of the caption style (the prototype's caption SelectionBox in stage.jsx, see model/stage-caption-move). While dragging it uses the store's document draft (preview and properties page follow together); on release it is written to the style document, and captions sharing the same style move together. For bilingual captions only the selected line is dragged (in the prototype each caption track is dragged separately). Marquee or ⇧ / ⌘ click selecting both lines and then dragging moves the group (when a marquee also catches picture elements, only the elements are kept).
 * - No handles appear when read-only, locked, or playing. Point selection still works in read-only mode. Pressing on the picture during playback only pauses (prototype stage.jsx), and selection works again after it stops.
 */

const root = style({ position: 'absolute', inset: 0, outlineStyle: 'none', userSelect: 'none', touchAction: 'none' });
const space = style({ position: 'absolute' });

/** The picture's position and display size on the stage (stage pixels). */
export interface FrameRect {
  left: number;
  top: number;
  width: number;
  height: number;
}

/** The change label for each kind of drag on commit. It is generated only at commit time, in the language current at that time. */
const LABEL: Record<Gesture['kind'], () => Localized> = {
  move: EditLabel.move,
  edge: EditLabel.resize,
  corner: EditLabel.scale,
  rotate: EditLabel.rotate,
  pan: EditLabel.reframe,
  'group-move': EditLabel.groupMove,
  'group-scale': EditLabel.groupScale,
};

/**
 * Dragging captions: the style document, body and root style at the start of the gesture; what the root style becomes when dragged to a certain place (moving a whole group moves the root style; dragging a single line in bilingual mode writes that line's override); and the line boxes of the lines dragged at the start (during dragging they are translated on screen, and the line boxes redrawn by the preview arrive one beat late). `remember` means whether to record the result into the new caption options after release: the position of a single dragged line lives in the line override, so new caption options do not record it, and the root-style anchor line moved to keep the other line from jumping should not be recorded either.
 */
interface CaptionDrag {
  move: CaptionMove;
  record: DocumentRecord | undefined;
  body: unknown;
  root: Json;
  restyle: (to: { x: number; y: number }) => Json;
  remember: boolean;
  hits: CaptionHit[];
}

/** One press: what to do once the threshold is passed (geometry gesture, caption drag or marquee); if it never moves and is released, what a single click does. */
interface Press {
  pointerId: number;
  client0: Point;
  frame: DOMRect;
  env: StageEnv;
  gesture: Gesture | null;
  caption: CaptionDrag | null;
  marquee: { additive: boolean } | null;
  click: () => void;
  moved: boolean;
  queued: { p: Point; mods: Modifiers } | null;
  raf: number;
}

/** Temporary box while dragging multiple items: used throughout the gesture; after release and commit, used until the new version arrives. */
interface Override {
  poses: Map<Id, Pose>;
  until: Revision | null;
}

const toCanvas = (canvas: CanvasSize, frame: DOMRect, clientX: number, clientY: number): Point => ({
  x: ((clientX - frame.left) * canvas.width) / frame.width,
  y: ((clientY - frame.top) * canvas.height) / frame.height,
});

const modsOf = (event: { shiftKey: boolean; altKey: boolean }): Modifiers => ({ shift: event.shiftKey, alt: event.altKey });

/** The browser still fires a click after pointerup: swallow it when a real drag happened, so it does not land elsewhere and clear the selection (prototype swallowDrag). */
function swallowClick(): void {
  const stop = (event: globalThis.MouseEvent) => {
    event.stopPropagation();
    event.preventDefault();
  };
  window.addEventListener('click', stop, { capture: true, once: true });
  window.setTimeout(() => window.removeEventListener('click', stop, true), 0);
}

/** Which instances are on this frame of the picture (updated with the frame plan; not re-rendered when unchanged). */
function useVisibleItems(engine: PreviewEngine): Id[] {
  const [ids, setIds] = useState<Id[]>([]);
  useEffect(
    () =>
      engine.onPlan((plan) => {
        const next = visibleItems(plan.layers);
        setIds((prev) => (prev.length === next.length && prev.every((id, i) => id === next[i]) ? prev : next));
      }),
    [engine],
  );
  return ids;
}

export function StageObjects({ sequence, frame }: { sequence: Sequence; frame: FrameRect }) {
  const { engine, apply, pause } = useEditorActions();
  const documents = useRuntime().videos.documents;
  const selection = useEditor((s) => s.selection);
  const playing = useEditor((s) => s.playing);
  const editable = useVideo((s) => canEdit(s.video));
  const visible = useVisibleItems(engine);
  const [captionHits, setCaptionHits] = useState<readonly CaptionHit[]>([]);
  useEffect(() => engine.onCaptionHits(setCaptionHits), [engine]);
  const rootRef = useRef<HTMLDivElement>(null);
  const spaceRef = useRef<HTMLDivElement>(null);
  const press = useRef<Press | null>(null);
  const latest = useRef(sequence);
  latest.current = sequence;
  const nudges = useRef({ inflight: 0, at: new Map<Id, Place>() });
  const [active, setActive] = useState<Gesture['kind'] | 'marquee' | null>(null);
  const [guides, setGuides] = useState<Guide[]>([]);
  const [marquee, setMarquee] = useState<Rect | null>(null);
  const [angle, setAngle] = useState<number | null>(null);
  const [override, setOverride] = useState<Override | null>(null);
  const [editing, setEditing] = useState<Id | null>(null);
  const [captionShift, setCaptionShift] = useState<{ hits: CaptionHit[]; dx: number; dy: number } | null>(null);

  const canvas = sequence.canvas;
  // The media box's height is derived from the source's aspect ratio, which requires looking up the asset table.
  const assets = useVideo((s) => s.video?.state?.video.assets);
  const view: View = { kx: frame.width / canvas.width, ky: frame.height / canvas.height };
  const byId = useMemo(() => new Map(sequence.items.map((item) => [item.id, item])), [sequence]);
  const locked = (item: SequenceItem) => item.locked || !!sequence.tracks.find((t) => t.id === item.trackId)?.locked;
  const changeable = (item: SequenceItem) => editable && !playing && !locked(item);
  const isMain = (id: Id) => {
    const item = byId.get(id);
    return !!item && isMainVideo(item, sequence);
  };

  // Temporary box for multi-item drag: used throughout the gesture; after commit it is discarded once the new version arrives.
  const overridePoses = override && (override.until === null || override.until === sequence.revision) ? override.poses : null;
  useEffect(() => {
    if (override?.until != null && override.until !== sequence.revision) setOverride(null);
  }, [override, sequence.revision]);
  const poseFor = (item: PlacedItem) => overridePoses?.get(item.id) ?? poseOf(item, canvas, assets);

  // The selected items that are on the picture right now and have a layout box. Text being edited is hidden on the canvas (not in the frame plan), but it still counts.
  const onStage = new Set(visible);
  if (editing) onStage.add(editing);
  const picked = selection
    .map((id) => byId.get(id))
    .filter((item): item is PlacedItem => !!item && isPlaced(item) && onStage.has(item.id));
  const others = picked.filter((item) => !isMainVideo(item, sequence));
  const single = picked.length === 1 ? picked[0]! : others.length === 1 ? others[0]! : null;
  const group = !single && others.length >= 2 ? others : null;
  const groupBounds = group ? boundsOf(group.map((item) => aabbOf(poseFor(item)))) : null;
  const groupChangeable = !!group && group.every(changeable);
  // If all selected items are captions with the same style, all editable, and present on the picture right now, show the caption toolbar (captions have no layout box, so they do not go through the items above).
  const pickedCaptions = selection.map((id) => byId.get(id)).filter((item): item is CaptionItem => item?.type === 'caption');
  const captionBar =
    pickedCaptions.length &&
    pickedCaptions.length === selection.length &&
    pickedCaptions.every((item) => item.styleDocumentId === pickedCaptions[0]!.styleDocumentId && changeable(item)) &&
    captionHits.some((hit) => selection.includes(hit.itemId))
      ? pickedCaptions
      : null;

  // ---- Engine temporary overrides (hiding the canvas text while dragging multiple items or editing text) ----

  const paintSequence = (seq: Sequence) => {
    const snapshot = useVideo.getState().video?.state?.video;
    if (snapshot) engine.setVideo(seq, snapshot.assets, snapshot.documents);
  };
  const paint = (drafts: ItemDraft[]) => paintSequence(applyDrafts(latest.current, drafts));
  const restore = () => paint([]);

  // While editing text: whenever that text on the canvas is revealed again (some other place gave the engine a new sequence), hide it again. This is deferred to a microtask so the engine finishes its synchronous work for this round first.
  // Which item is hidden is recorded in a ref and cleared synchronously when editing ends, so the new text drawn at commit time is not hidden again.
  const hidden = useRef<Id | null>(null);
  useEffect(() => {
    if (!editing) return;
    hidden.current = editing;
    const stop = engine.onPlan((plan) => {
      if (hidden.current !== editing || !plan.layers.some((layer) => layer.itemId === editing)) return;
      queueMicrotask(() => {
        const seq = latest.current;
        if (hidden.current === editing && seq.items.some((item) => item.id === editing))
          paint([{ itemId: editing, revision: seq.revision, patch: { place: { opacity: 0 } } }]);
      });
    });
    return () => {
      stop();
      if (hidden.current === editing) hidden.current = null;
    };
    // paint only reads refs and the store, does not change with rendering, and is not in the dependencies.
  }, [engine, editing]);
  useEffect(() => {
    if (editing && !byId.has(editing)) setEditing(null);
  }, [editing, byId]);

  // ---- Selection ----

  const select = (ids: Id[]) => useEditor.getState().select(ids);
  /** ⇧ / ⌘ click: toggles this item; the main video does not join multi-select. */
  const toggle = (id: Id) => {
    if (isMain(id)) return;
    const current = useEditor.getState().selection;
    select(current.includes(id) ? current.filter((x) => x !== id) : [...current.filter((x) => !isMain(x)), id]);
  };
  const hitTest = (p: Point) => {
    const selected = new Set(useEditor.getState().selection);
    const boxes = new Map(picked.map((item) => [item.id, poseFor(item)]));
    return hitAt(engine.plan?.layers ?? [], p, {
      captionHits: engine.captionHits,
      skip: (id) => isMain(id) && !selected.has(id),
      boxes,
      contains: poseContains,
    });
  };
  /** Snap references: other instances on the picture that have a layout box (the main video is excluded, since its edges are the canvas edges). */
  const snapRects = (exclude: Set<Id>): Rect[] =>
    visible.flatMap((id) => {
      const item = byId.get(id);
      return item && isPlaced(item) && !exclude.has(id) && !isMainVideo(item, sequence) ? [boxRect(poseOf(item, canvas, assets))] : [];
    });

  // ---- Gestures ----

  /** Draws this step. `live` means the gesture is still in progress (guide lines and the angle bubble are shown); on release at commit, only the final value is drawn. */
  const show = (gesture: Gesture, result: GestureFrame, live = true) => {
    const seq = latest.current;
    const members = membersOf(gesture);
    if ('members' in gesture) {
      paint(
        members.map((m, i) => ({
          itemId: m.item.id,
          revision: seq.revision,
          patch: gesturePatch(m.item, result.poses[i]!, result.factor, seq.canvas, assets),
        })),
      );
      setOverride({ poses: new Map(members.map((m, i) => [m.item.id, result.poses[i]!])), until: null });
    } else {
      const m = members[0]!;
      useEditor.getState().setDraft({
        itemId: m.item.id,
        revision: seq.revision,
        patch: gesturePatch(m.item, result.poses[0]!, result.factor, seq.canvas, assets, result.crop),
      });
    }
    setGuides(live ? result.guides : []);
    setAngle(live && gesture.kind === 'rotate' ? result.poses[0]!.rotation : null);
  };

  const discard = (gesture: Gesture) => {
    if ('members' in gesture) {
      setOverride(null);
      restore();
    } else useEditor.getState().clearDrafts();
  };

  const commit = (gesture: Gesture, result: GestureFrame) => {
    const seq = latest.current;
    const operations =
      gesture.kind === 'pan'
        ? result.crop
          ? cropOperations(seq.id, gesture.member.item, result.crop)
          : []
        : gestureOperations(seq.id, membersOf(gesture), result.poses, result.factor, seq.canvas);
    if (!operations.length) return discard(gesture);
    show(gesture, result, false);
    if ('members' in gesture) setOverride((o) => (o ? { ...o, until: seq.revision } : o));
    void apply(operations, LABEL[gesture.kind]()).then((receipt) => {
      if (!receipt) discard(gesture);
    });
  };

  // ---- Dragging captions ----

  /**
   * Pressing on a caption: the style body is available at this moment and the line to be dragged is drawn on the picture, so the gesture can start. `group` means both lines are selected (the group moves). Otherwise, when the same style has both source and translation lines in this frame (the renderer lays them out bilingually, see `compile` in frame-render), only this line is dragged.
   */
  const captionDragOf = (item: CaptionItem, p0: Point, group: boolean): CaptionDrag | null => {
    const records = useVideo.getState().video?.state?.video.documents ?? {};
    const record = item.styleDocumentId ? records[item.styleDocumentId] : undefined;
    if (item.styleDocumentId && !record) return null;
    const body = record
      ? draftedBody(useEditor.getState().documentDraft, record.id, record.currentRevision, documents.peek(record.id, record.currentRevision))
      : DEFAULT_CAPTION_STYLE;
    const root = body === undefined ? null : captionStyleRoot(body);
    if (!root) return null;
    const sharing = (id: Id) => {
      const other = byId.get(id);
      return other?.type === 'caption' && other.styleDocumentId === item.styleDocumentId ? other : null;
    };
    const lines = engine.captionHits.filter((hit) => sharing(hit.itemId));
    const own = captionKind(item.documentId, records);
    const paired = (engine.plan?.layers ?? []).some((layer) => {
      const other = layer.kind === 'caption' ? sharing(layer.itemId) : null;
      return !!other && captionKind(other.documentId, records) !== own;
    });
    if (paired && !group) {
      const hits = lines.filter((hit) => hit.itemId === item.id);
      const box = captionBox(hits);
      if (!box) return null;
      const canvas = latest.current.canvas;
      const { x0, y0, detached } = lineMoveStart(root, own, box, canvas);
      const rest = lines.filter((hit) => {
        const other = sharing(hit.itemId);
        return !!other && captionKind(other.documentId, records) !== own;
      });
      const anchorY = detached ? null : restackedRootY(root, own, rest, canvas);
      const restyle = (to: { x: number; y: number }) => movedLineStyle(root, own, to, detached, anchorY);
      return { move: { box, x0, y0, p0 }, record, body, root, restyle, remember: false, hits };
    }
    const box = captionBox(lines);
    if (!box) return null;
    const move = { box, x0: num(root.x, CAPTION_X), y0: num(root.y, CAPTION_Y), p0 };
    const selected = useEditor.getState().selection;
    const hits = lines.filter((hit) => (group ? selected.includes(hit.itemId) : hit.itemId === item.id));
    return { move, record, body, root, restyle: (to) => movedCaptionStyle(root, to), remember: true, hits };
  };

  const showCaption = (drag: CaptionDrag, result: CaptionMoveFrame) => {
    previewCaptionStyle(drag.record, drag.body, drag.restyle(result));
    setCaptionShift({ hits: drag.hits, dx: result.dx, dy: result.dy });
    setGuides(result.guides);
  };

  const commitCaption = (drag: CaptionDrag, result: CaptionMoveFrame) => {
    if (result.x === drag.move.x0 && result.y === drag.move.y0) return useEditor.getState().clearDrafts();
    const { record, body, root } = drag;
    const before = drag.remember ? root : null;
    saveCaptionStyle(apply, { sequence: latest.current, record, body, before, style: drag.restyle(result), label: EditLabel.move() });
  };

  const finishMarquee = (p: Press, clientX: number, clientY: number, additive: boolean) => {
    const seq = latest.current;
    const r = marqueeRect({ x: p.client0.x, y: p.client0.y }, { x: clientX, y: clientY });
    const corner = toCanvas(seq.canvas, p.frame, r.x, r.y);
    const scale = seq.canvas.width / p.frame.width;
    const rect = { x: corner.x, y: corner.y, w: r.w * scale, h: (r.h * seq.canvas.height) / p.frame.height };
    const candidates = visible.flatMap((id) => {
      const item = byId.get(id);
      return item && isPlaced(item) && !isMainVideo(item, seq) ? [{ id, rect: aabbOf(poseOf(item, seq.canvas, assets)) }] : [];
    });
    // Captions take part in marquee selection by their drawn line boxes (one caption may have several lines in this frame, combined into one box).
    const captions = [...new Set(engine.captionHits.map((hit) => hit.itemId))].flatMap((id) => {
      const rect = captionBox(engine.captionHits.filter((hit) => hit.itemId === id));
      return rect ? [{ id, rect }] : [];
    });
    const hits = marqueeHits([...candidates, ...captions], rect);
    const base = additive ? useEditor.getState().selection.filter((id) => !isMain(id)) : [];
    select(marqueeSelection(base, hits, (id) => byId.get(id)?.type === 'caption'));
  };

  const reset = () => {
    setActive(null);
    setCaptionShift(null);
    setGuides([]);
    setAngle(null);
    setMarquee(null);
  };

  const onPointerDown = (event: PointerEvent<HTMLDivElement>) => {
    if (event.button !== 0 || press.current) return;
    const target = event.target as Element;
    // The toolbar's popovers are mounted on body, but events still bubble up through the React tree to here: anything not inside the overlay is ignored (otherwise it would steal the pointer and block focus on input fields).
    if (!rootRef.current?.contains(target) || target.closest('[data-stage-editor]')) return;
    const rootEl = rootRef.current;
    const frameEl = spaceRef.current;
    if (!rootEl || !frameEl) return;
    event.preventDefault();
    rootEl.focus({ preventScroll: true });
    const fr = frameEl.getBoundingClientRect();
    if (!(fr.width > 0) || !(fr.height > 0)) return;
    const seq = latest.current;
    const p = toCanvas(seq.canvas, fr, event.clientX, event.clientY);
    const additive = event.shiftKey || event.metaKey || event.ctrlKey;
    const hit = hitTest(p);
    // An unselected main video does not block point selection; pressing on it and releasing without moving selects it (prototype: the main video can only be selected by clicking).
    const under = hit ?? hitAt(engine.plan?.layers ?? [], p, { captionHits: engine.captionHits });

    if (playing) {
      // Prototype stage.jsx: pressing the picture during playback only pauses. That click is swallowed, so selection is unchanged and no gesture starts.
      pause();
      swallowClick();
      return;
    }

    const handleEl = target.closest<HTMLElement>('[data-handle]');
    const inGroup = !!target.closest('[data-group]');
    let gesture: Gesture | null = null;
    let caption: CaptionDrag | null = null;
    let marqueeMode: Press['marquee'] = null;
    let click = () => {};
    let moving = new Set<Id>();

    if (group && groupBounds && inGroup && handleEl) {
      if (groupChangeable)
        gesture = { kind: 'group-scale', members: group.map((item) => memberOf(item, seq.canvas, assets)), bounds: groupBounds, p0: p };
    } else if (single && handleEl) {
      const handle = handleEl.dataset.handle as Handle;
      const member = memberOf(single, seq.canvas, assets);
      gesture = { kind: cornerScales(resizeKindOf(single), handle) ? 'corner' : 'edge', member, handle, p0: p };
      moving = new Set([single.id]);
    } else if (single && target.closest('[data-rotate]')) {
      gesture = { kind: 'rotate', member: memberOf(single, seq.canvas, assets), pivot: pivotOf(single, seq.canvas, assets), p0: p };
    } else if (group && inGroup && !additive) {
      if (groupChangeable) gesture = { kind: 'group-move', members: group.map((item) => memberOf(item, seq.canvas, assets)), p0: p };
    } else if (hit && !additive) {
      // Pressing on an item: if it is not selected, it becomes selected, and dragging moves it (the prototype requires selecting first before dragging; here, as in common editors, pressing is enough to drag).
      // If all selected items are captions with the same style (both bilingual lines were marquee-selected or ⇧ / ⌘ click-selected), pressing does not collapse the selection to one item, and dragging moves the whole group. If there is no movement on release, only that line is kept.
      const item = byId.get(hit);
      const current = useEditor.getState().selection;
      const captionGroup =
        item?.type === 'caption' &&
        current.length > 1 &&
        current.includes(hit) &&
        current.every((id) => {
          const other = byId.get(id);
          return other?.type === 'caption' && other.styleDocumentId === item.styleDocumentId;
        });
      if (captionGroup) click = () => select([hit]);
      else if (!current.includes(hit) || current.length > 1) select([hit]);
      // Full-frame, cover and cropped videos (child videos cut into shorts) have no box that can be moved: dragging pans their crop window, changing only this segment.
      if (item && isPannable(item) && changeable(item)) gesture = panGesture(item, p, seq.canvas, assets);
      else if (item && isPlaced(item) && changeable(item)) gesture = { kind: 'move', member: memberOf(item, seq.canvas, assets), p0: p };
      else if (item?.type === 'caption' && changeable(item) && (!captionGroup || current.every((id) => changeable(byId.get(id)!))))
        caption = captionDragOf(item, p, captionGroup);
      moving = new Set([hit]);
    } else {
      // On empty space, on the main video's surface, or while holding ⇧ / ⌘: dragging past 4px starts a marquee selection; releasing without moving is a single click.
      marqueeMode = { additive };
      click = additive ? () => under && toggle(under) : () => select(under ? [under] : []);
    }

    press.current = {
      pointerId: event.pointerId,
      client0: { x: event.clientX, y: event.clientY },
      frame: fr,
      env: { canvas: seq.canvas, others: snapRects(moving), pxScale: seq.canvas.width / fr.width },
      gesture,
      caption,
      marquee: marqueeMode,
      click,
      moved: false,
      queued: null,
      raf: 0,
    };
    rootEl.setPointerCapture(event.pointerId);
  };

  /** When not dragging: if there is a clickable instance under the pointer, the cursor changes to a hand (the selection box and handles have their own cursors). */
  const hover = (event: PointerEvent<HTMLDivElement>) => {
    const rootEl = rootRef.current;
    const frameEl = spaceRef.current;
    if (!rootEl || !frameEl || event.buttons) return;
    if (event.target !== rootEl && event.target !== frameEl) {
      rootEl.style.cursor = '';
      return;
    }
    const fr = frameEl.getBoundingClientRect();
    if (!(fr.width > 0)) return;
    const hit = hitTest(toCanvas(latest.current.canvas, fr, event.clientX, event.clientY));
    const item = hit ? byId.get(hit) : undefined;
    // Selected captions have no selection box of their own to capture the pointer, so when they can be dragged, the move cursor is set here.
    const movable = item?.type === 'caption' && changeable(item) && useEditor.getState().selection.includes(item.id);
    rootEl.style.cursor = movable ? 'move' : hit ? 'pointer' : '';
  };

  const flush = (p: Press) => {
    p.raf = 0;
    const queued = p.queued;
    if (!queued) return;
    p.queued = null;
    if (p.gesture) show(p.gesture, stepGesture(p.gesture, queued.p, queued.mods, p.env));
    else if (p.caption) showCaption(p.caption, stepCaptionMove(p.caption.move, queued.p, queued.mods, p.env));
  };

  const onPointerMove = (event: PointerEvent<HTMLDivElement>) => {
    const p = press.current;
    if (!p) return hover(event);
    if (event.pointerId !== p.pointerId) return;
    const dx = event.clientX - p.client0.x;
    const dy = event.clientY - p.client0.y;
    if (!p.moved) {
      if (p.gesture || p.caption) {
        if (Math.abs(dx) < DEAD_ZONE && Math.abs(dy) < DEAD_ZONE) return;
      } else if (!p.marquee || !marqueeRect(p.client0, { x: event.clientX, y: event.clientY }).on) return;
      p.moved = true;
      setActive(p.gesture?.kind ?? (p.caption ? 'move' : 'marquee'));
      if (p.caption && rootRef.current) rootRef.current.style.cursor = 'grabbing';
    }
    if (p.gesture || p.caption) {
      p.queued = { p: toCanvas(p.env.canvas, p.frame, event.clientX, event.clientY), mods: modsOf(event) };
      if (!p.raf) p.raf = requestAnimationFrame(() => flush(p));
      return;
    }
    const r = marqueeRect(p.client0, { x: event.clientX, y: event.clientY });
    setMarquee({ x: r.x - p.frame.left, y: r.y - p.frame.top, w: r.w, h: r.h });
  };

  const onPointerUp = (event: PointerEvent<HTMLDivElement>) => {
    const p = press.current;
    if (!p || event.pointerId !== p.pointerId) return;
    press.current = null;
    if (p.raf) cancelAnimationFrame(p.raf);
    if (!p.moved) return p.click();
    swallowClick();
    reset();
    // The release position is also counted: during fast drags the browser coalesces pointermove events.
    const at = toCanvas(p.env.canvas, p.frame, event.clientX, event.clientY);
    if (p.gesture) commit(p.gesture, stepGesture(p.gesture, at, modsOf(event), p.env));
    else if (p.caption) commitCaption(p.caption, stepCaptionMove(p.caption.move, at, modsOf(event), p.env));
    else if (p.marquee) finishMarquee(p, event.clientX, event.clientY, p.marquee.additive);
  };

  const onPointerCancel = (event: PointerEvent<HTMLDivElement>) => {
    const p = press.current;
    if (!p || event.pointerId !== p.pointerId) return;
    press.current = null;
    if (p.raf) cancelAnimationFrame(p.raf);
    if (p.moved && p.gesture) discard(p.gesture);
    else if (p.moved && p.caption) useEditor.getState().clearDrafts();
    reset();
  };

  // ---- Double-click: reset rotation to zero; edit text in place ----

  const onDoubleClick = (event: MouseEvent<HTMLDivElement>) => {
    if (!rootRef.current?.contains(event.target as Node)) return;
    // On press the root node captures the pointer, so the following click / dblclick land on the root node; find what was actually hit by the pointer position.
    const target = document.elementFromPoint(event.clientX, event.clientY) ?? (event.target as Element);
    if (target.closest('[data-stage-editor]') || target.closest('[data-handle]')) return;
    const seq = latest.current;
    const rotateEl = target.closest<HTMLElement>('[data-rotate]');
    if (rotateEl) {
      const item = byId.get(rotateEl.dataset.rotate ?? '');
      if (item && isPlaced(item) && changeable(item)) {
        const operations = resetRotation(seq.id, item);
        if (operations.length) void apply(operations, EditLabel.resetRotation());
      }
      return;
    }
    const frameEl = spaceRef.current;
    if (!frameEl) return;
    const hit = hitTest(toCanvas(seq.canvas, frameEl.getBoundingClientRect(), event.clientX, event.clientY));
    const item = hit ? byId.get(hit) : undefined;
    if (item?.type === 'caption') {
      select([item.id]);
      openCaptionEditor(item);
      return;
    }
    if (!item || item.type !== 'text' || item.counter || !changeable(item)) return;
    select([item.id]);
    setEditing(item.id);
  };

  const endEdit = (id: Id, text: string | null, byKey: boolean) => {
    hidden.current = null;
    setEditing(null);
    if (byKey) rootRef.current?.focus({ preventScroll: true });
    if (text === null) return restore();
    // Draw the new text first without waiting for the receipt (otherwise the picture is blank during the commit round trip).
    const seq = latest.current;
    paintSequence({ ...seq, items: seq.items.map((item) => (item.id === id && item.type === 'text' ? { ...item, text } : item)) });
    void apply([{ type: 'setText', sequenceId: latest.current.id, itemId: id, text }], EditLabel.editText()).then((receipt) => {
      if (!receipt) restore();
    });
  };

  // ---- Keyboard: when the stage has focus, arrow keys nudge (1%, ⇧ 5%, ⌥↑/↓ 0.1%; ⌥←/→ are left for the editor's time nudge) ----
  // Convention with the editor shortcuts (video-editor's useEditorKeys, attached in the window bubble phase): arrow keys the stage handles call preventDefault, and when the editor sees defaultPrevented it does not move the playhead. The root node carries `data-stage`, so while focus is here the editor's ←/→ does not move the playhead either.

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.target !== rootRef.current || event.metaKey || event.ctrlKey || !editable) return;
    const seq = latest.current;
    const delta = nudgeDelta(event.key, event.shiftKey, event.altKey, seq.canvas);
    if (!delta) return;
    // The selection takes precedence over playback: if there is something it can nudge, it nudges; otherwise it yields to the editor (frame by frame, or a 5-second jump during playback).
    const targets = picked.filter((item) => !isMainVideo(item, seq) && !locked(item));
    if (!targets.length) return;
    event.preventDefault();
    // When pressed repeatedly and the previous commit has not returned yet, keep nudging from the previous commit's landing point rather than recalculating from the old position.
    const pending = nudges.current;
    const base = targets.map((item) => {
      const place = pending.at.get(item.id);
      return place ? ({ ...item, place } as PlacedItem) : item;
    });
    const operations = nudgeOperations(seq.id, base, delta, seq.canvas, assets);
    if (!operations.length) return;
    for (const operation of operations) {
      if (operation.type !== 'setTransform') continue;
      const from = base.find((item) => item.id === operation.itemId)!.place;
      pending.at.set(operation.itemId, { ...from, x: operation.x ?? from.x, y: operation.y ?? from.y });
    }
    pending.inflight += 1;
    void apply(operations, EditLabel.nudgePosition()).finally(() => {
      pending.inflight -= 1;
      if (!pending.inflight) pending.at.clear();
    });
  };

  // ---- Drawing ----

  const dragging = active === 'move' || active === 'group-move' || active === 'pan';
  const editingItem = editing ? byId.get(editing) : undefined;
  let boxes: ReactNode = null;
  if (editingItem?.type === 'text') {
    boxes = (
      <ItemBox
        id={editingItem.id}
        pose={poseFor(editingItem)}
        view={view}
        kind="text"
        video={false}
        controls={false}
        movable={false}
        dragging={false}
        angle={null}
      >
        <StageTextEdit item={editingItem} view={view} canvas={canvas} onDone={(text, byKey) => endEdit(editingItem.id, text, byKey)} />
      </ItemBox>
    );
  } else if (single) {
    const can = changeable(single);
    boxes = (
      <ItemBox
        id={single.id}
        pose={poseFor(single)}
        view={view}
        kind={resizeKindOf(single)}
        video={single.type === 'video'}
        controls={can}
        movable={can}
        dragging={dragging}
        angle={active === 'rotate' ? angle : null}
      />
    );
  } else if (group) {
    boxes = (
      <>
        {group.map((item) => (
          <ThinBox key={item.id} pose={poseFor(item)} view={view} />
        ))}
        {groupBounds && !playing ? (
          <GroupBox bounds={groupBounds} view={view} count={group.length} controls={groupChangeable} dragging={dragging} />
        ) : null}
      </>
    );
  }

  return (
    <div
      ref={rootRef}
      className={root}
      tabIndex={0}
      role="group"
      aria-label={STAGE_COPY.label}
      data-stage
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerCancel}
      onDoubleClick={onDoubleClick}
      onKeyDown={onKeyDown}
    >
      <div ref={spaceRef} className={space} style={frame}>
        {boxes}
        {(captionShift
          ? captionShift.hits.map((hit) => ({ ...hit, cx: hit.cx + captionShift.dx, cy: hit.cy + captionShift.dy }))
          : captionHits.filter((hit) => selection.includes(hit.itemId))
        ).map((hit, index) => (
          <ThinBox key={`${hit.itemId}:${hit.cueId}:${index}`} pose={hit} view={view} />
        ))}
        {marquee ? <Marquee rect={marquee} /> : null}
        <Guides guides={guides} view={view} />
      </div>
      {single && !editingItem && changeable(single) ? (
        <StageToolbar key={single.id} item={single} sequence={sequence} frame={frame} view={view} yielding={active !== null} />
      ) : null}
      {single && isPannable(single) && changeable(single) && !dragging && showsShotChip(sequence, single) ? (
        <StageShotChip key={single.id} item={single} sequence={sequence} frame={frame} />
      ) : null}
      {captionBar && !editing ? (
        <StageCaptionToolbar items={captionBar} sequence={sequence} hits={captionHits} frame={frame} view={view} yielding={active !== null} />
      ) : null}
    </div>
  );
}
