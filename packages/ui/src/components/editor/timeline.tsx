import {
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type DragEvent,
  type MouseEvent as ReactMouseEvent,
  type PointerEvent as ReactPointerEvent,
  type ReactNode,
} from "react";
import type {
  AssetRecord,
  AudioItem,
  DocumentRecord,
  Id,
  Localized,
  Sequence,
  SequenceItem,
  Track,
} from "@cuccut/protocol";
import { mediaTimeToSeconds } from "@cuccut/protocol";
import { EditLabel } from "@cuccut/protocol/messages/ui";
import {
  ActionButton,
  ToastQueue,
  Tooltip,
  TooltipTrigger,
} from "@react-spectrum/s2";
import Animation from "@react-spectrum/s2/icons/Animation";
import AudioWave from "@react-spectrum/s2/icons/AudioWave";
import ChartBarVert from "@react-spectrum/s2/icons/ChartBarVert";
import Clock from "@react-spectrum/s2/icons/Clock";
import CloseCaptions from "@react-spectrum/s2/icons/CloseCaptions";
import Emoji from "@react-spectrum/s2/icons/Emoji";
import ImageIcon from "@react-spectrum/s2/icons/Image";
import Layers from "@react-spectrum/s2/icons/Layers";
import Lock from "@react-spectrum/s2/icons/Lock";
import LockOpen from "@react-spectrum/s2/icons/LockOpen";
import Shapes from "@react-spectrum/s2/icons/Shapes";
import TextIcon from "@react-spectrum/s2/icons/Text";
import TextNumbers from "@react-spectrum/s2/icons/TextNumbers";
import Translate from "@react-spectrum/s2/icons/Translate";
import Video from "@react-spectrum/s2/icons/Video";
import Visibility from "@react-spectrum/s2/icons/Visibility";
import VisibilityOff from "@react-spectrum/s2/icons/VisibilityOff";
import VolumeOff from "@react-spectrum/s2/icons/VolumeOff";
import VolumeTwo from "@react-spectrum/s2/icons/VolumeTwo";
import {
  iconStyle,
  style,
} from "@react-spectrum/s2/style" with { type: "macro" };
import {
  clipKind,
  durationSeconds,
  formatTimecode,
  frameAt,
  itemFrames,
  itemLabel,
  rulerLabel,
  rulerStep,
  snapTargets,
  stackingGroup,
  timelineRows,
  type ClipKind,
} from "../../model/editor.ts";
import { captionKindLabel } from "../../model/caption-tracks.ts";
import {
  importAndPlace,
  isPlaceable,
  moveOperation,
  placeAsset,
  trimBounds,
  trimOperation,
} from "../../model/editor-ops.ts";
import { kindOfFileName } from "../../model/space.ts";
import type { Rect } from "../../model/stage-pose.ts";
import {
  dubTrackGroup,
  roomAfter,
  stemTrackOf,
  stretchChanged,
  stretchSpeed,
  type DubBlock,
  type DubGroup,
  type Stretch,
} from "../../model/timeline-dub.ts";
import {
  marqueeItems,
  marqueeSelection,
  type MarqueeLane,
} from "../../model/timeline-marquee.ts";
import {
  rulerTicks,
  spanIndex,
  spansIn,
  type SpanIndex,
} from "../../model/timeline-window.ts";
import {
  anchoredScroll,
  clipSpanAt,
  selectionSpan,
  zoomFloor,
  zoomPlan,
  type ZoomAction,
} from "../../model/timeline-zoom.ts";
import { langName } from "../../model/tools-models.ts";
import {
  headTags,
  subtitleTrackLanguage,
  type HeadLanguage,
} from "../../model/track-heads.ts";
import { TIMELINE_ZOOM_COPY as ZOOM_COPY } from "../../copy.ts";
import { useRuntime } from "../../runtime/context.tsx";
import { useEditor } from "../../state/editor-store.ts";
import { canEdit, useVideo } from "../../state/video-store.ts";
import { ClipMedia } from "./clip-media.tsx";
import { DUB_REGEN_COPY, TIMELINE_DUB_COPY as DUB_COPY } from "./dub-copy.ts";
import { useEditorActions } from "./editor-context.tsx";
import { Marquee } from "./stage-boxes.tsx";
import { TimelineChapters } from "./timeline-chapters.tsx";
import { CaptionCues } from "./timeline-cues.tsx";
import {
  LiveCaptionRow,
  TranscriptRow,
  useLiveRows,
  useTranscriptRows,
} from "./timeline-live.tsx";
import { DubBlockView, stretchedLook, useDubBlocks } from "./timeline-dub.tsx";
import { DubHeadMenu, useDubTrack } from "./timeline-dub-head.tsx";
import { TimelineMenu, type TimelineMenuTarget } from "./timeline-menu.tsx";
import { CutBands } from "./timeline-seams.tsx";
import { useVisibleLane } from "./use-visible-lane.ts";
import "./editor.css";
import { EDITOR_COPY as E } from "./editor-copy.ts";

/** Data type used when dragging an asset: asset panel → timeline. */
export const ASSET_DRAG_TYPE = "application/x-cuccut-asset";

/** Header column width (prototype 144). */
const HEAD = 144;
/** Left and right padding of the lane. The style macro must evaluate statically, so this is a literal, with the same value as ZOOM_PAD in model/timeline-zoom. */
const PAD = 12;
const MAC = typeof navigator !== "undefined" && /Mac/.test(navigator.platform);
const RULER = 24;
/**
 * Row height: picture rows with video, which draw a filmstrip and the original-audio waveform, are taller. Other rows (image, text, sound, dub, subtitle) show no thumbnails, so they are equally short, the same height as subtitle rows (prototype LANE_H, 2026-10-08).
 */
const MEDIA_ROW_HEIGHT = 64;
const ROW_HEIGHT = 40;
/** Snap threshold (pixels; prototype 10px). */
const SNAP_PX = 10;
/** Moving more than this many pixels after pressing counts as a drag. */
const DRAG_PX = 3;
/** Video clips narrower than this don't draw the filmstrip and waveform; only the color block remains. */
const MEDIA_MIN_PX = 12;
/** Dragging more than this many pixels after pressing on blank space counts as a marquee selection; otherwise it's a click on blank space (design draft timeline.jsx `beginMarquee`). */
const MARQUEE_PX = 4;

/**
 * The timeline sets its own scroll position (zoom, playhead follow). Right after setting it, a `scroll` is dispatched, so the visible range (useVisibleLane) is updated before painting, instead of waiting for the browser's next dispatch of that event (which may not happen while the window is in the background).
 */
function scrollLaneTo(element: HTMLDivElement, left: number) {
  element.scrollLeft = left;
  element.dispatchEvent(new Event("scroll"));
}

const root = style({
  display: "flex",
  flexDirection: "column",
  minHeight: 0,
  flexShrink: 0,
  backgroundColor: "gray-25",
});
const scroller = style({
  position: "relative",
  flexGrow: 1,
  minHeight: 0,
  overflow: "auto",
});
const rulerRow = style({
  position: "sticky",
  top: 0,
  zIndex: 3,
  display: "flex",
  height: RULER,
  backgroundColor: "gray-25",
});
const corner = style({
  position: "sticky",
  insetStart: 0,
  zIndex: 4,
  flexShrink: 0,
  boxSizing: "border-box",
  width: HEAD,
  backgroundColor: "gray-25",
  borderEndWidth: 1,
  borderTopWidth: 0,
  borderStartWidth: 0,
  borderStyle: "solid",
  borderBottomWidth: 1,
  borderColor: "gray-200",
});
const rulerLane = style({
  position: "relative",
  flexShrink: 0,
  cursor: "pointer",
  borderBottomWidth: 1,
  borderTopWidth: 0,
  borderStartWidth: 0,
  borderEndWidth: 0,
  borderStyle: "solid",
  borderColor: "gray-200",
  userSelect: "none",
});
const tick = style({
  position: "absolute",
  bottom: 0,
  width: 1,
  backgroundColor: "gray-400",
});
const tickLabel = style({
  position: "absolute",
  top: 2,
  font: "ui-xs",
  color: "gray-600",
  whiteSpace: "nowrap",
  paddingStart: 4,
});
/** No lines are drawn between rows (same as the prototype); rows are told apart by the header column and the clips. */
const row = style({ position: "relative", display: "flex" });
/** When dragging a header to reorder, a line on the top or bottom edge of the row where it would drop. */
const trackDropLine = style({
  position: "absolute",
  insetStart: 0,
  insetEnd: 0,
  height: 2,
  backgroundColor: "blue-800",
  zIndex: 3,
  pointerEvents: "none",
});
/** Header: category icon and name, with the toggle on the right (prototype `.trow__hd`); the name of a disabled row is also de-emphasized. */
const header = style({
  position: "sticky",
  insetStart: 0,
  zIndex: 2,
  display: "flex",
  alignItems: "center",
  gap: "[6px]",
  flexShrink: 0,
  width: HEAD,
  paddingStart: 12,
  paddingEnd: 4,
  boxSizing: "border-box",
  backgroundColor: "gray-25",
  borderEndWidth: 1,
  borderTopWidth: 0,
  borderBottomWidth: 0,
  borderStartWidth: 0,
  borderStyle: "solid",
  borderColor: "gray-200",
  font: "ui-xs",
  color: { default: "gray-700", isOff: "gray-400" },
  cursor: { default: "default", isDraggable: "grab" },
  "--iconPrimary": { type: "fill", value: "currentColor" },
});
const headerLabel = style({
  flexGrow: 1,
  minWidth: 0,
  overflow: "hidden",
  textOverflow: "ellipsis",
  whiteSpace: "nowrap",
});
/** Language tags on subtitle and dub row headers (ZH, EN, PT-BR; prototype `.thd__lang`). They fit in any UI language; the full name is in the hover description. */
const headerTag = style({
  flexShrink: 0,
  marginEnd: "auto",
  paddingX: 4,
  borderRadius: "sm",
  backgroundColor: "gray-200",
  fontWeight: "bold",
  lineHeight: "[16px]",
  whiteSpace: "nowrap",
});
const headerToggles = style({
  display: "flex",
  alignItems: "center",
  flexShrink: 0,
});
/**
 * The small yellow dot on dub row headers when a sentence is too fast or not synthesized (design draft `.thd__fast`: this is not an error, so it is not orange-red). The header is only 144px. Putting the dot after the name would squeeze “配音 · 英语” into an ellipsis, so it is attached to the top-right corner of the track icon and takes no space from the name.
 */
const headerFlag = style({
  position: "absolute",
  top: "[calc(50% - 9px)]",
  insetStart: "[26px]",
  width: 6,
  height: 6,
  borderRadius: "full",
  backgroundColor: "yellow-700",
});
const TRACK_ICON: Record<Track["kind"], typeof Video> = {
  visual: Layers,
  audio: AudioWave,
  subtitle: CloseCaptions,
};
/**
 * The clip area of one track. The fonts of clips and dub blocks are set here and inherited by them (other text in the track sets its own font: counters, subtitle blocks).
 * Mounting thousands of clips and dub blocks for a whole film at once: the more atomic classes a style macro puts on an element, the slower the style calculation. So clips keep only the few state-varying properties in the style macro; the unchanging geometry and typography are in editor.css `.cc-clip`, and the font is inherited.
 */
const lane = style({
  position: "relative",
  flexShrink: 0,
  font: "ui-xs",
  backgroundColor: { default: "transparent", isDropTarget: "blue-100" },
});
/**
 * The parts of a clip chip that change with its hue and state; geometry, radius and type live in editor.css (`.cc-clip`).
 * agentcut's chips: footage is neutral (the filmstrip carries the colour), sound is green, and a selected chip of any
 * kind wears the accent edge. (The theme maps Spectrum's blue family onto the yellow accent, so `blue-800` is the accent.)
 */
const clip = style({
  borderWidth: { default: 1, isSelected: 2 },
  cursor: { default: "grab", isLocked: "not-allowed" },
  backgroundColor: {
    hue: {
      neutral: { default: "gray-200", isSelected: "gray-300" },
      orange: { default: "orange-200", isSelected: "orange-300" },
      purple: { default: "purple-200", isSelected: "purple-300" },
      green: { default: "green-200", isSelected: "green-300" },
      cyan: { default: "cyan-200", isSelected: "cyan-300" },
      magenta: { default: "magenta-200", isSelected: "magenta-300" },
    },
  },
  borderColor: {
    hue: {
      neutral: { default: "gray-400", isSelected: "blue-800" },
      orange: { default: "orange-400", isSelected: "blue-800" },
      purple: { default: "purple-400", isSelected: "blue-800" },
      green: { default: "green-400", isSelected: "blue-800" },
      cyan: { default: "cyan-400", isSelected: "blue-800" },
      magenta: { default: "magenta-400", isSelected: "blue-800" },
    },
  },
  color: {
    hue: {
      neutral: "gray-900",
      orange: "orange-1100",
      purple: "purple-1100",
      green: "green-1100",
      cyan: "cyan-1100",
      magenta: "magenta-1100",
    },
  },
  opacity: { default: 1, isDisabled: 0.5 },
});
type ClipHue = "neutral" | "orange" | "purple" | "green" | "cyan" | "magenta";
/** Each kind's hue and icon. */
const CLIP_LOOKS: Record<ClipKind, { hue: ClipHue; icon: typeof Video }> = {
  video: { hue: "neutral", icon: Video },
  image: { hue: "orange", icon: ImageIcon },
  audio: { hue: "green", icon: AudioWave },
  text: { hue: "orange", icon: TextIcon },
  shape: { hue: "green", icon: Shapes },
  composition: { hue: "magenta", icon: Animation },
  caption: { hue: "purple", icon: CloseCaptions },
  counter: { hue: "orange", icon: TextNumbers },
  progress: { hue: "cyan", icon: Clock },
  sticker: { hue: "purple", icon: Emoji },
  visualizer: { hue: "magenta", icon: ChartBarVert },
  // Newer element kinds borrow an existing hue and icon for now.
  confetti: { hue: "purple", icon: Animation },
  draw: { hue: "green", icon: Shapes },
  placeholder: { hue: "neutral", icon: Layers },
  whiteboard: { hue: "orange", icon: ImageIcon },
};
const clipIcon = iconStyle({ size: "XS" });
const clipTitle = style({
  display: "flex",
  alignItems: "center",
  gap: 4,
  minWidth: 0,
});
const clipName = style({
  overflow: "hidden",
  textOverflow: "ellipsis",
  whiteSpace: "nowrap",
  fontWeight: "bold",
});
const clipMeta = style({
  overflow: "hidden",
  textOverflow: "ellipsis",
  whiteSpace: "nowrap",
  opacity: 0.75,
});
const ghost = style({
  position: "absolute",
  top: 4,
  bottom: 4,
  boxSizing: "border-box",
  borderRadius: "sm",
  borderWidth: 1,
  borderStyle: "dashed",
  borderColor: "gray-500",
  opacity: 0.45,
  pointerEvents: "none",
});
const readout = style({
  position: "absolute",
  top: -2,
  zIndex: 5,
  font: "ui-xs",
  color: "white",
  backgroundColor: "gray-800",
  borderRadius: "sm",
  paddingX: 4,
  whiteSpace: "nowrap",
  pointerEvents: "none",
});
const emptyBox = style({
  position: "absolute",
  top: 8,
  bottom: 8,
  insetStart: PAD,
  width: 360,
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  borderWidth: 1,
  borderStyle: "dashed",
  borderColor: "gray-300",
  borderRadius: "lg",
  font: "ui-sm",
  color: "gray-600",
  pointerEvents: "none",
});

/** Drop position when dragging a header: another row in the same stack, placed above or below it on screen. */
interface TrackDrop {
  trackId: Id;
  position: "above" | "below";
}

/**
 * Up and down on the timeline → up and down for `moveTrack`: picture and subtitle rows are sorted by `order` from high to low (higher ones first); sound rows are sorted from low to high (model/editor.ts `trackRows`). So the “above” of a sound row is the side with the smaller `order`.
 */
function trackPlacement(
  kind: Track["kind"],
  position: TrackDrop["position"],
): "above" | "below" {
  if (stackingGroup(kind) === "picture") return position;
  return position === "above" ? "below" : "above";
}

/** Dragged to the row right next to its own, on the side nearest to itself: the position is unchanged and it doesn't count as a move. */
function trackDropChanges(
  rows: readonly { track: Track }[],
  trackId: Id,
  drop: TrackDrop,
): boolean {
  const from = rows.findIndex((row) => row.track.id === trackId);
  const to = rows.findIndex((row) => row.track.id === drop.trackId);
  if (from < 0 || to < 0) return false;
  if (drop.position === "above" && to === from + 1) return false;
  if (drop.position === "below" && to === from - 1) return false;
  return true;
}

type Gesture =
  | {
      kind: "move";
      itemId: Id;
      itemIds: Id[];
      originX: number;
      started: boolean;
      deltaFrames: number;
      trackId: Id | null;
      /** How many pixels a clip moves vertically within its row when the track changes (the element does not change parent, so pointer capture isn't broken). */
      offsetY: number;
      snap: number | null;
    }
  | {
      kind: "trim";
      itemId: Id;
      edge: "start" | "end";
      frame: number;
      snap: number | null;
    }
  | {
      /** Hold a header and drag to reorder this track up or down within its stack. The target is another row in the same stack (picture and subtitle form one stack, sound forms another), placed above or below it (up and down on screen). */
      kind: "track";
      trackId: Id;
      originY: number;
      started: boolean;
      /** How many pixels the row follows the pointer. */
      offsetY: number;
      target: TrackDrop | null;
    }
  /** Dragging a dub block's right edge changes that sentence's speed; one `setSpeed` on release. `room` is the length up to the start of the next item on the same track. */
  | {
      kind: "stretch";
      itemId: Id;
      originX: number;
      seconds0: number;
      room: number | null;
      stretch: Stretch | null;
    }
  | {
      /** Pressing blank space and dragging out a rectangle marquee-selects. The start is recorded as a time (so it doesn't drift when zoomed) and as a vertical position in content coordinates; the current point is computed from the last pointer position. */
      kind: "marquee";
      t0: number;
      y0: number;
      t1: number;
      y1: number;
      clientX: number;
      clientY: number;
      /** Holding ⇧ / ⌘ / Ctrl: merge into the existing selection. */
      additive: boolean;
      started: boolean;
    };

export interface TimelineHandle {
  /** Zoom action (shared by the zoom menu on the transport bar, the buttons, and the shortcuts): uses the lane width, the scroll position, and the playhead. */
  zoom(action: ZoomAction): void;
}

export function Timeline({
  videoId,
  sequence,
  assets,
  documents,
  height,
  handle,
}: {
  videoId: Id | null;
  sequence: Sequence;
  assets: Record<Id, AssetRecord>;
  documents: Record<Id, DocumentRecord>;
  height: number;
  handle: { current: TimelineHandle | null };
}) {
  const runtime = useRuntime();
  const { apply, seek } = useEditorActions();
  const editable = useVideo((s) => canEdit(s.video));
  const pps = useEditor((s) => s.pxPerSecond);
  const selection = useEditor((s) => s.selection);
  // ⌥←/→ nudges not yet committed: draw the offset against the same video version. When the version changes (the commit has landed), it no longer stacks.
  const nudge = useEditor((s) => s.nudge);
  const revision = useVideo((s) => s.video?.state?.video.revision);
  const nudged = nudge && nudge.revision === revision ? nudge : null;
  const [menu, setMenu] = useState<TimelineMenuTarget | null>(null);
  const { select, toggleSelect, setZoom } = useEditor.getState();
  const scrollRef = useRef<HTMLDivElement>(null);
  const laneRefs = useRef(new Map<Id, HTMLDivElement>());
  // Width of the timeline scroll area (including the header column); null until the ResizeObserver has measured it.
  const [measured, setViewport] = useState<number | null>(null);
  const viewport = measured ?? 800;
  const [gesture, setGestureState] = useState<Gesture | null>(null);
  // Pointer events may arrive faster than repaints: gestures use the ref as the source of truth; state is only used to redraw.
  const gestureRef = useRef<Gesture | null>(null);
  const setGesture = (next: Gesture | null) => {
    gestureRef.current = next;
    setGestureState(next);
  };
  const [dropTrack, setDropTrack] = useState<Id | null>(null);
  const fps = sequence.fps;
  const perSecond = fps.num / fps.den;
  const rows = useMemo(() => timelineRows(sequence), [sequence]);
  // Picture rows with video (taller; see MEDIA_ROW_HEIGHT).
  const mediaTracks = useMemo(
    () =>
      new Set(
        sequence.items
          .filter((item) => item.type === "video")
          .map((item) => item.trackId),
      ),
    [sequence],
  );
  const rowHeight = (track: Track) =>
    track.kind === "visual" && mediaTracks.has(track.id)
      ? MEDIA_ROW_HEIGHT
      : ROW_HEIGHT;
  // Language tag on subtitle and dub row headers, and whether a subtitle row is the original or the translation (model/track-heads.ts).
  const heads = useMemo(() => {
    const languages: HeadLanguage[] = [];
    const kinds = new Map<Id, "original" | "translation">();
    for (const { track } of rows) {
      if (track.kind === "subtitle") {
        const info = subtitleTrackLanguage(sequence, track, documents);
        if (!info) continue;
        kinds.set(track.id, info.kind);
        languages.push({
          trackId: track.id,
          group: "subtitle",
          language: info.language,
        });
      } else if (track.kind === "audio") {
        const group = dubTrackGroup(sequence, track.id);
        if (group)
          languages.push({
            trackId: track.id,
            group: "dub",
            language: group.language,
          });
      }
    }
    return { tags: headTags(languages), kinds };
  }, [rows, sequence, documents]);
  const duration = durationSeconds(sequence);
  const laneWidth = Math.max(viewport - HEAD, PAD * 2 + (duration + 30) * pps);
  const tracks = useMemo(
    () => new Map(sequence.tracks.map((t) => [t.id, t])),
    [sequence.tracks],
  );
  const items = useMemo(
    () => new Map(sequence.items.map((i) => [i.id, i])),
    [sequence.items],
  );
  // Items on each track are sorted by start: only those that intersect the visible time window are drawn (model/timeline-window.ts).
  const lanes = useMemo(() => {
    const byTrack = new Map<Id, SequenceItem[]>();
    for (const item of sequence.items) {
      const list = byTrack.get(item.trackId);
      if (list) list.push(item);
      else byTrack.set(item.trackId, [item]);
    }
    return new Map<Id, SpanIndex<SequenceItem>>(
      [...byTrack].map(([id, list]) => [
        id,
        spanIndex(list, (item) => itemFrames(item, fps)),
      ]),
    );
  }, [sequence.items, fps]);
  const dubs = useDubBlocks(sequence, documents, assets);
  // During the first transcription there is no subtitle track yet, so the recognized paragraphs are drawn first on a temporary row (timeline-live.tsx).
  const liveRows = useLiveRows(videoId, sequence, documents);
  // Transcribed, but no subtitle track exists at all (no subtitle layer was created during transcription): the transcript is drawn on a read-only row, so the timeline isn't empty.
  const transcripts = useTranscriptRows(sequence, documents, liveRows);
  // Visible horizontal range (lane coordinates, pixels), with one extra screen on each side, so no blank area shows while scrolling, zooming, or paging through playback.
  const view = useVisibleLane(scrollRef, HEAD, 1);

  const xOf = (seconds: number) => PAD + seconds * pps;
  const xOfFrame = (frame: number) => xOf(frame / perSecond);

  useEffect(() => {
    const element = scrollRef.current;
    if (!element) return;
    const observer = new ResizeObserver(([entry]) =>
      setViewport(entry?.contentRect.width ?? 800),
    );
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  // The lower zoom limit follows the duration and the lane width, so a long video can zoom out to fit the whole film. It is not written until the lane width is measured, so a guessed width doesn't clamp the remembered zoom.
  useEffect(() => {
    if (measured !== null)
      useEditor.getState().setZoomFloor(zoomFloor(duration, measured - HEAD));
  }, [measured, duration]);

  // The scroll position after zooming is computed from the new pixels-per-second and set after the new width has been painted (useLayoutEffect).
  // ⌘/Ctrl + wheel zooms anchored on the time under the pointer. React's wheel listener is passive, so this attaches its own.
  const zoomAnchor = useRef<((pps: number) => number) | null>(null);
  /** Change the zoom and set the scroll position by `scrollFor`. When the zoom is clamped and unchanged, set the scroll directly, without leaving a stale anchor. */
  const zoomTo = (next: number, scrollFor: (pps: number) => number) => {
    const before = useEditor.getState().pxPerSecond;
    zoomAnchor.current = scrollFor;
    setZoom(next);
    const after = useEditor.getState().pxPerSecond;
    if (after !== before) return;
    zoomAnchor.current = null;
    const element = scrollRef.current;
    if (element) scrollLaneTo(element, scrollFor(after));
  };
  useEffect(() => {
    const element = scrollRef.current;
    if (!element) return;
    const onWheel = (event: WheelEvent) => {
      if (!event.ctrlKey && !event.metaKey) return;
      event.preventDefault();
      const rect = element.getBoundingClientRect();
      const x = event.clientX - rect.left - HEAD;
      const current = useEditor.getState().pxPerSecond;
      const seconds = (element.scrollLeft + x - PAD) / current;
      // zoomTo only touches the ref and the store, so the copy from the first render is always usable.
      zoomTo(current * Math.exp(-event.deltaY / 300), (next) =>
        anchoredScroll(seconds, x, next),
      );
    };
    element.addEventListener("wheel", onWheel, { passive: false });
    return () => element.removeEventListener("wheel", onWheel);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  // With no anchor (the lower limit clamped the zoom), still dispatch a scroll once: when the content gets narrower, the scroll position the browser clamped must be switched to the new visible range right away.
  useLayoutEffect(() => {
    const scrollFor = zoomAnchor.current;
    const element = scrollRef.current;
    if (!element) return;
    zoomAnchor.current = null;
    scrollLaneTo(element, scrollFor ? scrollFor(pps) : element.scrollLeft);
  }, [pps]);

  handle.current = {
    zoom: (action) => {
      const element = scrollRef.current;
      if (!element) return;
      const {
        pxPerSecond,
        playhead,
        selection: selected,
      } = useEditor.getState();
      const span =
        action === "fitClip"
          ? clipSpanAt(sequence, selected, playhead)
          : action === "fitSelection"
            ? selectionSpan(sequence, selected)
            : null;
      if (action === "fitClip" && !span)
        return void ToastQueue.neutral(ZOOM_COPY.noClip, { timeout: 2500 });
      if (action === "fitSelection" && !span)
        return void ToastQueue.neutral(ZOOM_COPY.noSelection, {
          timeout: 2500,
        });
      const lane = (measured ?? element.clientWidth) - HEAD;
      const plan = zoomPlan(
        action,
        { pxPerSecond, scroll: element.scrollLeft, lane, duration, playhead },
        span,
      );
      if (!plan) return;
      // The planned scroll is computed from the planned zoom. If the value the store clamped to differs from it (the lower limit isn't written yet), recompute with the same anchor.
      const anchor = (plan.scroll + lane / 2 - PAD) / plan.pxPerSecond;
      zoomTo(plan.pxPerSecond, (next) =>
        next === plan.pxPerSecond
          ? plan.scroll
          : anchoredScroll(anchor, lane / 2, next),
      );
    },
  };

  // ---- coordinates ----

  const frameAtClientX = (clientX: number) => {
    const element = scrollRef.current;
    if (!element) return 0;
    const x =
      clientX -
      element.getBoundingClientRect().left -
      HEAD +
      element.scrollLeft;
    return Math.max(0, ((x - PAD) / pps) * perSecond);
  };
  const trackAtClientY = (clientY: number): Track | null => {
    for (const [id, element] of laneRefs.current) {
      const rect = element.getBoundingClientRect();
      if (clientY >= rect.top && clientY < rect.bottom)
        return tracks.get(id) ?? null;
    }
    return null;
  };
  /** Viewport coordinates → timeline content coordinates (the layer that scrolls; left includes the header column, top includes the ruler). */
  const contentPoint = (clientX: number, clientY: number) => {
    const element = scrollRef.current;
    if (!element) return { x: 0, y: 0 };
    const rect = element.getBoundingClientRect();
    return {
      x: clientX - rect.left - element.clientLeft + element.scrollLeft,
      y: clientY - rect.top - element.clientTop + element.scrollTop,
    };
  };
  /** Vertical position of each row in content coordinates (measured from the DOM: the row's offsetParent is the content layer). */
  const measureLanes = (): MarqueeLane[] =>
    rows.flatMap(({ track }) => {
      const element = laneRefs.current.get(track.id);
      return element
        ? [
            {
              trackId: track.id,
              top: element.offsetTop,
              height: element.offsetHeight,
            },
          ]
        : [];
    });
  const marqueeRect = (g: Extract<Gesture, { kind: "marquee" }>): Rect => {
    const x0 = HEAD + xOf(g.t0);
    const x1 = HEAD + xOf(g.t1);
    return {
      x: Math.min(x0, x1),
      y: Math.min(g.y0, g.y1),
      w: Math.abs(x1 - x0),
      h: Math.abs(g.y1 - g.y0),
    };
  };
  const snapThreshold = (SNAP_PX / pps) * perSecond;

  /** Snap to the nearest target within the threshold. `edges` are the edges being moved (frames); returns the offset to apply. */
  const snapOffset = (
    edges: number[],
    targets: number[],
  ): { offset: number; at: number | null } => {
    let best: { offset: number; at: number } | null = null;
    for (const edge of edges) {
      for (const target of targets) {
        const offset = target - edge;
        if (
          Math.abs(offset) <= snapThreshold &&
          (!best || Math.abs(offset) < Math.abs(best.offset))
        )
          best = { offset, at: target };
      }
    }
    return best ?? { offset: 0, at: null };
  };

  // ---- gestures ----
  // After pressing, movement and release are tracked on window rather than relying on element pointer capture: during a drag the capture is lost if the window loses focus, and the pointer may leave the clip.
  // If no release arrives (it was released in another window), the gesture is abandoned and not committed.

  const onClipPointerDown = (
    event: ReactPointerEvent<HTMLDivElement>,
    item: SequenceItem,
  ) => {
    // Right-click (and macOS ⌃-click) opens the menu without changing the selection or starting a gesture (see onClipContextMenu).
    if (event.button !== 0 || (MAC && event.ctrlKey)) {
      event.stopPropagation();
      return;
    }
    event.stopPropagation();
    if (event.shiftKey || event.metaKey || event.ctrlKey) {
      toggleSelect(item.id);
      return;
    }
    const group = selection.includes(item.id) ? selection : [item.id];
    if (!selection.includes(item.id)) select([item.id]);
    if (!editable || item.locked || tracks.get(item.trackId)?.locked) return;
    event.currentTarget.setPointerCapture(event.pointerId);
    setGesture({
      kind: "move",
      itemId: item.id,
      itemIds: group,
      originX: event.clientX,
      started: false,
      deltaFrames: 0,
      trackId: null,
      offsetY: 0,
      snap: null,
    });
  };

  /** Right-clicking a clip: if it isn't selected, select only it first (prototype timeline-menu.jsx), and the menu opens at the pointer. */
  const onClipContextMenu = (
    event: ReactMouseEvent<HTMLDivElement>,
    item: SequenceItem,
  ) => {
    event.preventDefault();
    event.stopPropagation();
    if (gestureRef.current) return;
    if (!useEditor.getState().selection.includes(item.id)) select([item.id]);
    setMenu({ itemId: item.id, x: event.clientX, y: event.clientY });
  };

  const onHandlePointerDown = (
    event: ReactPointerEvent<HTMLDivElement>,
    item: SequenceItem,
    edge: "start" | "end",
  ) => {
    if (event.button !== 0) return;
    event.stopPropagation();
    select([item.id]);
    if (!editable) return;
    event.currentTarget.setPointerCapture(event.pointerId);
    const range = itemFrames(item, fps);
    setGesture({
      kind: "trim",
      itemId: item.id,
      edge,
      frame: Math.round(edge === "start" ? range.start : range.end),
      snap: null,
    });
  };

  /** The right edge of a dub block: drag it to change this sentence's speed (design draft timeline-dub.jsx `beginStretch`). */
  const onStretchPointerDown = (
    event: ReactPointerEvent<HTMLDivElement>,
    item: AudioItem,
  ) => {
    if (event.button !== 0) return;
    event.stopPropagation();
    select([item.id]);
    if (!editable || item.locked || tracks.get(item.trackId)?.locked) return;
    event.currentTarget.setPointerCapture(event.pointerId);
    setGesture({
      kind: "stretch",
      itemId: item.id,
      originX: event.clientX,
      seconds0: mediaTimeToSeconds(item.playDuration),
      room: roomAfter(sequence, item),
      stretch: null,
    });
  };

  /** When more than one row is in the same stack (picture and subtitle in one stack, sound in one), headers can be dragged to reorder them. Locked rows don't drag; read-only doesn't drag either. */
  const canDragTrack = (track: Track) =>
    editable &&
    !track.locked &&
    rows.filter(
      (r) => stackingGroup(r.track.kind) === stackingGroup(track.kind),
    ).length > 1;

  /** Hold a header: drag to reorder this track up or down (the design draft allows dragging headers). Pressing on the toggle button doesn't count. */
  const onHeaderPointerDown = (
    event: ReactPointerEvent<HTMLDivElement>,
    track: Track,
  ) => {
    if (event.button !== 0 || !canDragTrack(track)) return;
    if ((event.target as HTMLElement).closest('button, [role="button"], input'))
      return;
    event.currentTarget.setPointerCapture(event.pointerId);
    setGesture({
      kind: "track",
      trackId: track.id,
      originY: event.clientY,
      started: false,
      offsetY: 0,
      target: null,
    });
  };

  /** Pressing on blank space in the track area: dragging out a rectangle marquee-selects; without dragging, it's a click on blank space (clears the selection; no change while a modifier key is held). Clips, headers, and the ruler handle their own presses. */
  const onBlankPointerDown = (event: ReactPointerEvent<HTMLDivElement>) => {
    const element = scrollRef.current;
    if (event.button !== 0 || (MAC && event.ctrlKey) || !element) return;
    const rect = element.getBoundingClientRect();
    // Pressing on a scrollbar doesn't count.
    if (
      event.clientX - rect.left - element.clientLeft >= element.clientWidth ||
      event.clientY - rect.top - element.clientTop >= element.clientHeight
    )
      return;
    const p = contentPoint(event.clientX, event.clientY);
    const t = (p.x - HEAD - PAD) / pps;
    setGesture({
      kind: "marquee",
      t0: t,
      y0: p.y,
      t1: t,
      y1: p.y,
      clientX: event.clientX,
      clientY: event.clientY,
      additive: event.shiftKey || event.metaKey || event.ctrlKey,
      started: false,
    });
  };

  /** The marquee's current point follows the pointer (if the view scrolls while dragging, it is recomputed from the last pointer position). */
  const marqueeTo = (
    gesture: Extract<Gesture, { kind: "marquee" }>,
    clientX: number,
    clientY: number,
  ) => {
    const p = contentPoint(clientX, clientY);
    const t1 = (p.x - HEAD - PAD) / pps;
    const started =
      gesture.started ||
      Math.max(Math.abs(t1 - gesture.t0) * pps, Math.abs(p.y - gesture.y0)) >=
        MARQUEE_PX;
    setGesture({ ...gesture, t1, y1: p.y, clientX, clientY, started });
  };

  const onGestureMove = (event: PointerEvent) => {
    const gesture = gestureRef.current;
    if (!gesture) return;
    if (gesture.kind === "marquee")
      return marqueeTo(gesture, event.clientX, event.clientY);
    if (gesture.kind === "stretch") {
      const item = items.get(gesture.itemId);
      if (item?.type !== "audio") return;
      const want = gesture.seconds0 + (event.clientX - gesture.originX) / pps;
      setGesture({
        ...gesture,
        stretch: stretchSpeed(item, want, gesture.room),
      });
      return;
    }
    if (gesture.kind === "track") {
      const dy = event.clientY - gesture.originY;
      if (!gesture.started && Math.abs(dy) < DRAG_PX) return;
      // The drop target is a row in the same stack as the pointer. When the pointer is between rows, or dragged past the top or bottom row (the bottom row is often partly clipped), use the nearest row; whether to go above or below is decided by whether it lands in that row's upper or lower half.
      const own = tracks.get(gesture.trackId);
      let target: TrackDrop | null = null;
      let nearest = Number.POSITIVE_INFINITY;
      for (const [id, element] of laneRefs.current) {
        const kind = tracks.get(id)?.kind;
        if (
          id === gesture.trackId ||
          !kind ||
          !own ||
          stackingGroup(kind) !== stackingGroup(own.kind)
        )
          continue;
        const rect = element.getBoundingClientRect();
        const middle = (rect.top + rect.bottom) / 2;
        const distance = Math.abs(event.clientY - middle);
        if (distance >= nearest) continue;
        nearest = distance;
        target = {
          trackId: id,
          position: event.clientY < middle ? "above" : "below",
        };
      }
      if (target && !trackDropChanges(rows, gesture.trackId, target))
        target = null;
      setGesture({ ...gesture, started: true, offsetY: dy, target });
      return;
    }
    const playheadFrame = frameAt(useEditor.getState().playhead, fps);
    if (gesture.kind === "move") {
      const dx = event.clientX - gesture.originX;
      if (!gesture.started && Math.abs(dx) < DRAG_PX) return;
      const moved = gesture.itemIds
        .map((id) => items.get(id))
        .filter((i): i is SequenceItem => !!i);
      const grabbed = items.get(gesture.itemId);
      if (!grabbed) return;
      let delta = Math.round((dx / pps) * perSecond);
      const range = itemFrames(grabbed, fps);
      const snapped = snapOffset(
        [range.start + delta, range.end + delta],
        snapTargets(sequence, playheadFrame, new Set(gesture.itemIds)),
      );
      delta += Math.round(snapped.offset);
      const earliest = Math.min(...moved.map((i) => itemFrames(i, fps).start));
      delta = Math.max(delta, -Math.floor(earliest));
      const over = moved.length === 1 ? trackAtClientY(event.clientY) : null;
      const trackId =
        over && over.kind === tracks.get(grabbed.trackId)?.kind && !over.locked
          ? over.id
          : null;
      const from =
        laneRefs.current.get(grabbed.trackId)?.getBoundingClientRect().top ?? 0;
      const to = trackId
        ? (laneRefs.current.get(trackId)?.getBoundingClientRect().top ?? from)
        : from;
      setGesture({
        ...gesture,
        started: true,
        deltaFrames: delta,
        trackId,
        offsetY: to - from,
        snap: snapped.at,
      });
      return;
    }
    const item = items.get(gesture.itemId);
    if (!item) return;
    const raw = frameAtClientX(event.clientX);
    const snapped = snapOffset(
      [raw],
      snapTargets(sequence, playheadFrame, new Set([item.id])),
    );
    const range = itemFrames(item, fps);
    const bounds = trimBounds(item, assets, sequence);
    let frame = Math.round(raw + snapped.offset);
    frame =
      gesture.edge === "start"
        ? Math.min(Math.max(frame, bounds.min), Math.ceil(range.end) - 1)
        : Math.max(Math.min(frame, bounds.max), Math.floor(range.start) + 1);
    setGesture({
      ...gesture,
      frame,
      snap: snapped.at === frame ? snapped.at : null,
    });
  };

  const onGestureEnd = () => {
    const done = gestureRef.current;
    setGesture(null);
    if (!done) return;
    if (done.kind === "marquee") {
      if (!done.started) {
        if (!done.additive) select([]);
        return;
      }
      const hits = marqueeItems(
        sequence,
        { head: HEAD, pad: PAD, pxPerSecond: pps, lanes: measureLanes() },
        marqueeRect(done),
      );
      select(
        marqueeSelection(useEditor.getState().selection, hits, done.additive),
      );
      return;
    }
    if (done.kind === "stretch") {
      const item = items.get(done.itemId);
      if (
        item?.type === "audio" &&
        done.stretch &&
        stretchChanged(item, done.stretch)
      ) {
        void apply(
          [
            {
              type: "setSpeed",
              sequenceId: sequence.id,
              itemId: item.id,
              rate: done.stretch.rate,
            },
          ],
          EditLabel.stretchDub(),
        );
      }
      return;
    }
    if (done.kind === "track") {
      const track = tracks.get(done.trackId);
      if (!done.started || !done.target || !track) return;
      void apply(
        [
          {
            type: "moveTrack",
            sequenceId: sequence.id,
            trackId: done.trackId,
            target: done.target.trackId,
            position: trackPlacement(track.kind, done.target.position),
          },
        ],
        EditLabel.moveTrack(),
      );
      return;
    }
    if (done.kind === "move") {
      if (!done.started) return;
      const operation = moveOperation(sequence, {
        itemId: done.itemId,
        itemIds: done.itemIds,
        deltaFrames: done.deltaFrames,
        trackId: done.trackId,
      });
      if (operation)
        void apply(
          [operation],
          done.itemIds.length > 1 ? EditLabel.moveClips() : undefined,
        );
      return;
    }
    const item = items.get(done.itemId);
    const operation = item
      ? trimOperation(sequence, item, done.edge, done.frame)
      : null;
    if (operation) void apply([operation]);
  };

  const gestureHandlers = useRef({ move: onGestureMove, end: onGestureEnd });
  gestureHandlers.current = { move: onGestureMove, end: onGestureEnd };
  const gestureActive = gesture !== null;
  useEffect(() => {
    if (!gestureActive) return;
    const onMove = (event: PointerEvent) => {
      if (event.buttons === 0) setGesture(null);
      else gestureHandlers.current.move(event);
    };
    // The release position also counts as a move: during a fast drag the browser coalesces pointermove events, so the last segment may only appear in pointerup.
    const onUp = (event: PointerEvent) => {
      gestureHandlers.current.move(event);
      gestureHandlers.current.end();
    };
    const onCancel = () => setGesture(null);
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      event.preventDefault();
      event.stopPropagation();
      setGesture(null);
    };
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    window.addEventListener("pointercancel", onCancel);
    window.addEventListener("keydown", onKey, true);
    return () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      window.removeEventListener("pointercancel", onCancel);
      window.removeEventListener("keydown", onKey, true);
    };
  }, [gestureActive]);

  // Scrolling during a marquee (wheel, trackpad): the pointer hasn't moved, so the rectangle's current point moves with the content.
  const marqueeTracking = useRef(marqueeTo);
  marqueeTracking.current = marqueeTo;
  const marqueeActive = gesture?.kind === "marquee";
  useEffect(() => {
    const element = scrollRef.current;
    if (!marqueeActive || !element) return;
    const onScroll = () => {
      const current = gestureRef.current;
      if (current?.kind === "marquee")
        marqueeTracking.current(current, current.clientX, current.clientY);
    };
    element.addEventListener("scroll", onScroll);
    return () => element.removeEventListener("scroll", onScroll);
  }, [marqueeActive]);

  // ---- Drag in: an asset from the asset panel, or a file dragged in from the computer ----

  const acceptsDrop = (event: DragEvent) =>
    editable &&
    (event.dataTransfer.types.includes(ASSET_DRAG_TYPE) ||
      event.dataTransfer.types.includes("Files"));

  const onLaneDragOver = (event: DragEvent<HTMLDivElement>, track: Track) => {
    if (!acceptsDrop(event)) return;
    event.preventDefault();
    event.dataTransfer.dropEffect = "copy";
    if (dropTrack !== track.id) setDropTrack(track.id);
  };

  const onLaneDrop = (event: DragEvent<HTMLDivElement>, track: Track) => {
    setDropTrack(null);
    if (!acceptsDrop(event)) return;
    event.preventDefault();
    const frame = Math.round(frameAtClientX(event.clientX));
    const assetId = event.dataTransfer.getData(ASSET_DRAG_TYPE);
    if (assetId) {
      const asset = assets[assetId];
      if (asset && isPlaceable(asset))
        void apply(
          placeAsset(sequence, asset, frame, track.id),
          EditLabel.addClip(),
        );
      return;
    }
    const files = [...event.dataTransfer.files]
      .map((file) => ({
        path: runtime.host.pathForFile(file),
        name: file.name,
      }))
      .filter((file) => file.path);
    if (!files.length) return;
    const kinds = files.map((file) => {
      const kind = kindOfFileName(file.name);
      return {
        path: file.path,
        kind:
          kind === "video-file"
            ? ("video" as const)
            : kind === "audio" || kind === "image"
              ? kind
              : null,
      };
    });
    void apply(
      importAndPlace(sequence, kinds, frame, track.id),
      EditLabel.importAndAdd(),
    );
  };

  // ---- Playhead: click the ruler to position it, press and hold to drag ----

  const scrub = useRef(false);
  const onRulerPointerDown = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (event.button !== 0) return;
    scrub.current = true;
    event.currentTarget.setPointerCapture(event.pointerId);
    seek(frameAtClientX(event.clientX) / perSecond);
  };

  const steps = rulerStep(pps);
  const ticks = rulerTicks({
    minor: steps.minor,
    major: steps.major,
    from: (view.left - PAD) / pps,
    to: (view.right - PAD) / pps,
    end: (laneWidth - PAD) / pps,
  });

  const startOf = (item: SequenceItem) => itemFrames(item, fps);
  const moving = gesture?.kind === "move" && gesture.started ? gesture : null;
  const trimming = gesture?.kind === "trim" ? gesture : null;
  const draggingTrack =
    gesture?.kind === "track" && gesture.started ? gesture : null;
  const stretching = gesture?.kind === "stretch" ? gesture : null;
  const marquee =
    gesture?.kind === "marquee" && gesture.started ? gesture : null;
  const gestureItemId =
    gesture && gesture.kind !== "marquee" && gesture.kind !== "track"
      ? gesture.itemId
      : null;

  // ---- Only draw items inside the time window ----
  // Items outside the window get no DOM. Items that must be drawn even outside the window: the one being pressed (move, trim, and stretch all call setPointerCapture on it, and unmounting drops the capture) and the one with the right-click menu. Items being dragged or nudged are judged by their moved positions. Selected items needn't be pinned: the selection state lives in the store, so when scrolled back in they're mounted again and drawn as selected. Clips and dub blocks don't take focus (cut bands are handled separately; see timeline-seams.tsx).
  const windowFrom = ((view.left - PAD) / pps) * perSecond;
  const windowTo = ((view.right - PAD) / pps) * perSecond;
  const pinned: SequenceItem[] = [];
  const pin = (id: Id | null | undefined) => {
    const item = id ? items.get(id) : undefined;
    if (item) pinned.push(item);
  };
  pin(gestureItemId);
  pin(menu?.itemId);
  const shifting = gesture?.kind === "move" ? gesture : null;
  if (shifting || nudged) {
    const moved = new Set(shifting?.itemIds);
    const nudgedIds = new Set(nudged?.itemIds);
    for (const id of new Set([...moved, ...nudgedIds])) {
      const item = items.get(id);
      if (!item) continue;
      const delta =
        (moved.has(id) ? shifting!.deltaFrames : 0) +
        (nudgedIds.has(id) ? nudged!.deltaFrames : 0);
      const range = itemFrames(item, fps);
      if (range.end + delta >= windowFrom && range.start + delta <= windowTo)
        pinned.push(item);
    }
  }
  const laneItems = (track: Track) => {
    const index = lanes.get(track.id);
    return index ? spansIn(index, windowFrom, windowTo, pinned) : [];
  };

  const renderClip = (item: SequenceItem) => {
    const range = startOf(item);
    const shift =
      nudged && nudged.itemIds.includes(item.id) ? nudged.deltaFrames : 0;
    let start = range.start + shift;
    let end = range.end + shift;
    if (moving && moving.itemIds.includes(item.id)) {
      start += moving.deltaFrames;
      end += moving.deltaFrames;
    }
    if (trimming && trimming.itemId === item.id) {
      if (trimming.edge === "start") start = trimming.frame;
      else end = trimming.frame;
    }
    const stretched =
      stretching?.itemId === item.id ? stretching.stretch : null;
    if (stretched) end = start + stretched.seconds * perSecond;
    const left = xOfFrame(start);
    const width = Math.max(2, xOfFrame(end) - left);
    const name = itemLabel(item, assets, documents);
    const track = tracks.get(item.trackId);
    const locked = item.locked || !!track?.locked;
    const selected = selection.includes(item.id);
    const active =
      (moving && moving.itemIds.includes(item.id)) ||
      trimming?.itemId === item.id;
    const seconds = (end - start) / perSecond;
    const look = CLIP_LOOKS[clipKind(item)];
    const muted = item.type === "audio" && !!item.mix.muted;
    const moved =
      (moving && moving.itemIds.includes(item.id) ? moving.deltaFrames : 0) +
      shift;
    const dub = item.type === "audio" ? dubs.get(item.id) : undefined;
    if (dub && item.type === "audio") {
      return (
        <DubBlockView
          key={item.id}
          dub={dub}
          name={name}
          left={left}
          width={width}
          selected={selected}
          locked={locked}
          editable={editable}
          off={!item.enabled || !!track?.muted}
          active={!!active}
          stretchSpeed={stretched ? stretched.speed : null}
          style={{
            zIndex: active || stretching?.itemId === item.id ? 6 : 1,
            transform:
              moving && moving.itemId === item.id && moving.offsetY
                ? `translateY(${moving.offsetY}px)`
                : undefined,
          }}
          onPointerDown={(event) => onClipPointerDown(event, item)}
          onContextMenu={(event) => onClipContextMenu(event, item)}
          onStretchPointerDown={(event) => onStretchPointerDown(event, item)}
        />
      );
    }
    const title =
      width > 36 ? (
        <span className={clipTitle}>
          <look.icon styles={clipIcon} data-cc-icons="own" />
          <span className={clipName}>{name}</span>
        </span>
      ) : null;
    return (
      <div
        key={item.id}
        className={`${clip({ hue: look.hue, isSelected: selected, isLocked: locked, isDisabled: !item.enabled || muted })} cc-clip cc-clip-item`}
        style={{
          left,
          width,
          zIndex: active ? 6 : 1,
          transform:
            moving && moving.itemId === item.id && moving.offsetY
              ? `translateY(${moving.offsetY}px)`
              : undefined,
        }}
        data-active={active || undefined}
        title={`${name} · ${formatTimecode(start / perSecond, fps)} – ${formatTimecode(end / perSecond, fps)}`}
        onPointerDown={(event) => onClipPointerDown(event, item)}
        onContextMenu={(event) => onClipContextMenu(event, item)}
      >
        {item.type === "video" && width >= MEDIA_MIN_PX ? (
          <ClipMedia
            videoId={videoId}
            item={item}
            record={assets[item.assetRef.id]?.revisions[item.assetRef.revision]}
            clipLeft={left}
            clipWidth={width}
            clipStart={start / perSecond}
            contentStart={(range.start + moved) / perSecond}
            pxPerSecond={pps}
            scrollRef={scrollRef}
            head={HEAD}
            selected={selected}
            muted={!item.embeddedAudio.enabled || !!track?.muted}
            title={title}
          />
        ) : item.type === "caption" ? (
          <CaptionCues
            item={item}
            sequence={sequence}
            record={documents[item.documentId]}
            clipLeft={left}
            xOf={xOf}
            scrollRef={scrollRef}
            head={HEAD}
            selected={selected}
            fallback={title}
          />
        ) : (
          <>
            {title}
            {width > 90 ? (
              <span className={clipMeta}>{E.seconds2(seconds)}</span>
            ) : null}
          </>
        )}
        {!locked && editable && (width > 10 || trimming?.itemId === item.id) ? (
          <>
            <div
              className="cc-clip-handle"
              data-edge="start"
              onPointerDown={(event) =>
                onHandlePointerDown(event, item, "start")
              }
            />
            <div
              className="cc-clip-handle"
              data-edge="end"
              onPointerDown={(event) => onHandlePointerDown(event, item, "end")}
            />
          </>
        ) : null}
      </div>
    );
  };

  const snapFrameAt = moving?.snap ?? trimming?.snap ?? null;
  // Readout while dragging a dub block's right edge: the new speed and the new duration, next to the right edge (design draft `.ttip`, “1.25× · 2.40 s”).
  const stretchReadout = (() => {
    const item = stretching?.stretch ? items.get(stretching.itemId) : undefined;
    const dub = item ? dubs.get(item.id) : undefined;
    if (!stretching?.stretch || !item || !dub) return null;
    const { rate } = stretchedLook(dub, stretching.stretch.speed);
    return {
      trackId: item.trackId,
      frame: startOf(item).start + stretching.stretch.seconds * perSecond,
      text: DUB_COPY.stretching(rate, stretching.stretch.seconds),
    };
  })();
  /**
   * Track header. Subtitle rows show a language tag (a translation icon replaces it for translated rows); the full name and original / translation go in the hover description. For a dub row where the whole track holds just one dub group, the language tag is shown and the full name “配音 · 语言” (Dub · language) goes in the hover description. The sentence count, the yellow dot, and the trailing ⋯ are in DubTrackHeader.
   */
  const trackHeader = (track: Track, label: string) => {
    const group =
      track.kind === "audio" ? dubTrackGroup(sequence, track.id) : null;
    const tag = heads.tags.get(track.id);
    if (!group) {
      // Dub stems split off a dub: the headers read “背景声 · 语言” (Background · language) and “人声 · 语言” (Vocals · language), same as dub rows.
      const stem =
        track.kind === "audio" ? stemTrackOf(sequence, track.id) : null;
      const name = stem?.language
        ? DUB_COPY.stemTrackLabel(stem.stem, langName(stem.language))
        : label;
      const kind = heads.kinds.get(track.id);
      return (
        <TrackHeader
          track={track}
          label={name}
          tag={tag}
          icon={kind === "translation" ? Translate : undefined}
          hint={kind ? `${name} · ${captionKindLabel(kind)}` : name}
          flag={false}
          editable={editable}
          sequenceId={sequence.id}
          draggable={canDragTrack(track)}
          onDragStart={(event) => onHeaderPointerDown(event, track)}
        />
      );
    }
    const name = group.language
      ? DUB_COPY.trackLabel(langName(group.language))
      : label;
    return (
      <DubTrackHeader
        track={track}
        group={group}
        name={name}
        tag={tag}
        sequence={sequence}
        documents={documents}
        blocks={dubs}
        editable={editable}
        draggable={canDragTrack(track)}
        onDragStart={(event) => onHeaderPointerDown(event, track)}
      />
    );
  };
  const readoutFrame = moving
    ? (() => {
        const grabbed = items.get(moving.itemId);
        return grabbed ? startOf(grabbed).start + moving.deltaFrames : null;
      })()
    : trimming
      ? trimming.frame
      : null;

  return (
    <div className={root} style={{ height }} aria-label={E.timeline}>
      <TimelineChapters sequence={sequence} />
      <div
        ref={scrollRef}
        className={`${scroller} cc-scroll`}
        onPointerDown={onBlankPointerDown}
      >
        <div
          style={{
            position: "relative",
            width: HEAD + laneWidth,
            minHeight: "100%",
            userSelect:
              marquee || gesture?.kind === "track" ? "none" : undefined,
          }}
        >
          <div className={rulerRow}>
            <div className={corner} />
            <div
              className={rulerLane}
              style={{ width: laneWidth }}
              onPointerDown={(event) => {
                event.stopPropagation();
                onRulerPointerDown(event);
              }}
              onPointerMove={(event) => {
                if (scrub.current && event.buttons === 0) scrub.current = false;
                if (scrub.current)
                  seek(frameAtClientX(event.clientX) / perSecond);
              }}
              onPointerUp={() => {
                scrub.current = false;
              }}
              onLostPointerCapture={() => {
                scrub.current = false;
              }}
            >
              {ticks.map((t) => (
                <span key={t.seconds}>
                  <span
                    className={tick}
                    style={{ left: xOf(t.seconds), height: t.major ? 10 : 5 }}
                  />
                  {t.major ? (
                    <span
                      className={tickLabel}
                      style={{ left: xOf(t.seconds) }}
                    >
                      {rulerLabel(t.seconds, steps.major)}
                    </span>
                  ) : null}
                </span>
              ))}
              <PlayheadFlag pps={pps} scroller={scrollRef} />
            </div>
          </div>

          {liveRows.map((jobId) => (
            <LiveCaptionRow
              key={jobId}
              jobId={jobId}
              sequence={sequence}
              assets={assets}
              height={ROW_HEIGHT}
              rowClass={row}
              headerClass={header({ isOff: false })}
              laneClass={lane({ isDropTarget: false })}
              laneWidth={laneWidth}
              pps={pps}
              xOf={xOf}
              view={view}
              onSeek={seek}
            />
          ))}
          {transcripts.map((source) => (
            <TranscriptRow
              key={source.assetId}
              source={source}
              sequence={sequence}
              height={ROW_HEIGHT}
              rowClass={row}
              headerClass={header({ isOff: false })}
              laneClass={lane({ isDropTarget: false })}
              laneWidth={laneWidth}
              xOf={xOf}
              view={view}
              onSeek={seek}
            />
          ))}
          {rows.map(({ track, label }) => (
            <div
              key={track.id}
              className={row}
              style={{
                height: rowHeight(track),
                // While a header is being dragged, this row follows the pointer (no reparenting, so pointer capture holds) and is layered over the other rows.
                transform:
                  draggingTrack?.trackId === track.id
                    ? `translateY(${draggingTrack.offsetY}px)`
                    : undefined,
                zIndex: draggingTrack?.trackId === track.id ? 6 : undefined,
                opacity: draggingTrack?.trackId === track.id ? 0.85 : undefined,
              }}
            >
              {draggingTrack?.target?.trackId === track.id ? (
                <div
                  className={trackDropLine}
                  style={
                    draggingTrack.target.position === "above"
                      ? { top: -1 }
                      : { bottom: -1 }
                  }
                />
              ) : null}
              {trackHeader(track, label)}
              <div
                ref={(element) => {
                  if (element) laneRefs.current.set(track.id, element);
                  else laneRefs.current.delete(track.id);
                }}
                className={lane({
                  isDropTarget:
                    dropTrack === track.id ||
                    (moving?.trackId === track.id &&
                      moving.trackId !== items.get(moving.itemId)?.trackId),
                })}
                style={{ width: laneWidth }}
                onDragOver={(event) => onLaneDragOver(event, track)}
                onDragLeave={() => setDropTrack(null)}
                onDrop={(event) => onLaneDrop(event, track)}
              >
                {moving
                  ? moving.itemIds
                      .map((id) => items.get(id))
                      .filter(
                        (item): item is SequenceItem =>
                          !!item && item.trackId === track.id,
                      )
                      .map((item) => {
                        const range = startOf(item);
                        if (range.end < windowFrom || range.start > windowTo)
                          return null;
                        return (
                          <div
                            key={`ghost-${item.id}`}
                            className={ghost}
                            style={{
                              left: xOfFrame(range.start),
                              width:
                                xOfFrame(range.end) - xOfFrame(range.start),
                            }}
                          />
                        );
                      })
                  : null}
                {laneItems(track).map(renderClip)}
                {readoutFrame !== null &&
                gestureItemId &&
                items.get(gestureItemId)?.trackId === track.id ? (
                  <span
                    className={readout}
                    style={{ left: xOfFrame(readoutFrame) }}
                  >
                    {formatTimecode(readoutFrame / perSecond, fps)}
                  </span>
                ) : null}
                {stretchReadout?.trackId === track.id ? (
                  <span
                    className={readout}
                    style={{
                      left: xOfFrame(stretchReadout.frame),
                      transform: "translateX(-100%)",
                    }}
                  >
                    {stretchReadout.text}
                  </span>
                ) : null}
              </div>
            </div>
          ))}

          {/* Cut bands run through all tracks (prototype timeline-cutbands.jsx). They are collapsed while clips are dragged or nudged, and kept while marquee-selecting. */}
          {(gesture && gesture.kind !== "marquee") || nudged ? null : (
            <CutBands
              sequence={sequence}
              assets={assets}
              documents={documents}
              xOfFrame={(frame) => HEAD + xOfFrame(frame)}
              top={RULER}
              height={rows.reduce(
                (sum, { track }) => sum + rowHeight(track),
                (liveRows.length + transcripts.length) * ROW_HEIGHT,
              )}
              pps={pps}
              frames={{ from: windowFrom, to: windowTo }}
              editable={editable}
            />
          )}

          {sequence.items.length === 0 && rows.length ? (
            <div
              className={emptyBox}
              style={{
                top: RULER + 8,
                left: HEAD + PAD,
                height: rowHeight(rows[0]!.track) - 16,
              }}
            >
              {E.emptyTimeline}
            </div>
          ) : null}

          {snapFrameAt !== null ? (
            <div
              className="cc-snapline"
              style={{ left: HEAD + xOfFrame(snapFrameAt) }}
            />
          ) : null}
          {marquee ? (
            // Layered above the clips (z 1–6); doesn't take pointer events. The rectangle itself looks the same as the stage marquee.
            <div
              style={{
                position: "absolute",
                left: 0,
                top: 0,
                zIndex: 7,
                pointerEvents: "none",
              }}
            >
              <Marquee rect={marqueeRect(marquee)} />
            </div>
          ) : null}
          <Playhead pps={pps} scroller={scrollRef} />
        </div>
      </div>
      <TimelineMenu
        target={menu}
        sequence={sequence}
        assets={assets}
        documents={documents}
        dubBlocks={dubs}
        onClose={() => setMenu(null)}
      />
    </div>
  );
}

/** The playhead subscribes separately: while playing, only this line is redrawn each frame. It runs the full height of the track area (down to the bottom even when there are few tracks). When playback runs past the visible range, the view pages along. */
function Playhead({
  pps,
  scroller,
}: {
  pps: number;
  scroller: { current: HTMLDivElement | null };
}) {
  const playhead = useEditor((s) => s.playhead);
  const playing = useEditor((s) => s.playing);
  const left = HEAD + playheadX(playhead, pps);
  useEffect(() => {
    const element = scroller.current;
    if (!element || !playing) return;
    const x = left - HEAD;
    const visible = element.clientWidth - HEAD;
    // The right side keeps PAD: with “fit to window”, the end of the film lands exactly at visible - PAD, so playing to the end doesn't page the view.
    if (x < element.scrollLeft || x > element.scrollLeft + visible - PAD)
      scrollLaneTo(element, Math.max(0, Math.round(x - visible / 4)));
  }, [left, playing, scroller]);
  const underHeads = useScrolledUnderHeads(scroller, left - HEAD);
  if (underHeads) return null;
  return <div className="cc-playhead" style={{ left }} aria-hidden />;
}

/** The playhead flag on the ruler: placed in the ruler, which is already sticky, so it stays at the top edge during vertical scrolling. It uses the same `playheadX` as the vertical line and subscribes separately too, so only it is redrawn during playback. */
function PlayheadFlag({
  pps,
  scroller,
}: {
  pps: number;
  scroller: { current: HTMLDivElement | null };
}) {
  const playhead = useEditor((s) => s.playhead);
  const left = playheadX(playhead, pps);
  const underHeads = useScrolledUnderHeads(scroller, left);
  if (underHeads) return null;
  return <span className="cc-playhead-flag" style={{ left }} aria-hidden />;
}

/**
 * Whether a lane position (from the lane's start) is scrolled out to the left, under the sticky track heads: the playhead
 * line and flag are not drawn over the heads then. Only the scroll offset is state here, so a scroll re-renders just the
 * playhead leaves, and the answer itself only changes at the boundary.
 */
function useScrolledUnderHeads(
  scroller: { current: HTMLDivElement | null },
  laneX: number,
): boolean {
  const [scrollLeft, setScrollLeft] = useState(0);
  useEffect(() => {
    const element = scroller.current;
    if (!element) return;
    const sync = () => setScrollLeft(element.scrollLeft);
    sync();
    element.addEventListener("scroll", sync, { passive: true });
    return () => element.removeEventListener("scroll", sync);
  }, [scroller]);
  return laneX < scrollLeft - 0.5;
}

/**
 * The horizontal position of the playhead in the lane, rounded to device pixels. The vertical line's border is drawn on whole pixels, while the flag's diagonal edge is anti-aliased at sub-pixel positions. Without rounding, each rounds separately, and while moving they jump back and forth within ±1px; after rounding, their relative position stays constant. HEAD is an integer, so adding it to the vertical line doesn't affect the rounding.
 */
function playheadX(seconds: number, pps: number) {
  const dpr = window.devicePixelRatio || 1;
  return Math.round((PAD + seconds * pps) * dpr) / dpr;
}

/**
 * Dub track header: the tooltip on the name gives this track's sentence count (not synthesized, too fast, muted, regenerating). When a sentence is too fast or not synthesized, a small yellow dot lights up. A ⋯ sits at the end (timeline-dub-head.tsx). The count and the ⋯ header share one source (the design draft uses `trackLine` in both places).
 */
function DubTrackHeader({
  track,
  group,
  name,
  tag,
  sequence,
  documents,
  blocks,
  editable,
  draggable,
  onDragStart,
}: {
  track: Track;
  group: DubGroup;
  name: string;
  /** Language tag (EN, ZH). Not given when there is no language; the header then shows the full name. */
  tag?: string;
  sequence: Sequence;
  documents: Record<Id, DocumentRecord>;
  blocks: ReadonlyMap<Id, DubBlock>;
  editable: boolean;
  draggable: boolean;
  onDragStart(event: ReactPointerEvent<HTMLDivElement>): void;
}) {
  const { counts } = useDubTrack(group, sequence, documents, blocks);
  return (
    <TrackHeader
      track={track}
      label={name}
      tag={tag}
      hint={`${name} · ${DUB_REGEN_COPY.headLine(counts)}`}
      flag={counts.fast > 0 || counts.failed > 0}
      menu={
        <DubHeadMenu
          group={group}
          label={name}
          sequence={sequence}
          documents={documents}
          blocks={blocks}
        />
      }
      editable={editable}
      sequenceId={sequence.id}
      draggable={draggable}
      onDragStart={onDragStart}
    />
  );
}

function TrackHeader({
  track,
  label,
  tag,
  icon,
  hint,
  flag,
  menu,
  editable,
  sequenceId,
  draggable,
  onDragStart,
}: {
  track: Track;
  /** Full name: written on the header when there is no tag; also used as the screen reader name for the toggle. */
  label: string;
  /** Language tag (subtitle and dub rows): when given, it is shown instead of the full name. */
  tag?: string;
  /** Replaces the icon by category (translated subtitle rows show the translation icon). */
  icon?: typeof Video;
  /** Hover description on the name (dub rows give the sentence count, too-fast sentences, and muting). */
  hint: string;
  /** Dub row with too-fast sentences: a small yellow dot after the name. */
  flag: boolean;
  /** The ⋯ at the end of a dub row. */
  menu?: ReactNode;
  editable: boolean;
  sequenceId: Id;
  /** When there is more than one row in the same stack, they can be reordered by dragging. */
  draggable: boolean;
  onDragStart(event: ReactPointerEvent<HTMLDivElement>): void;
}) {
  const { apply } = useEditorActions();
  const update = (
    patch: { visible?: boolean; muted?: boolean; locked?: boolean },
    what: Localized,
  ) =>
    void apply(
      [{ type: "updateTrack", sequenceId, trackId: track.id, ...patch }],
      what,
    );
  const off = track.kind === "audio" ? track.muted : !track.visible;
  const Icon = icon ?? TRACK_ICON[track.kind];
  return (
    <div
      className={header({ isOff: off, isDraggable: draggable })}
      onPointerDown={(event) => {
        event.stopPropagation();
        onDragStart(event);
      }}
    >
      <Icon styles={clipIcon} data-cc-icons="own" />
      {tag ? (
        <span className={headerTag} title={hint}>
          {tag}
        </span>
      ) : (
        <span className={headerLabel} title={hint}>
          {label}
        </span>
      )}
      {flag ? <span className={headerFlag} title={hint} /> : null}
      <span className={headerToggles}>
        {track.kind !== "audio" ? (
          <HeaderToggle
            label={track.visible ? E.hideTrack(label) : E.showTrack(label)}
            isDisabled={!editable}
            onPress={() =>
              update(
                { visible: !track.visible },
                track.visible ? EditLabel.hideTrack() : EditLabel.showTrack(),
              )
            }
          >
            {track.visible ? <Visibility /> : <VisibilityOff />}
          </HeaderToggle>
        ) : null}
        {track.kind !== "subtitle" ? (
          <HeaderToggle
            label={track.muted ? E.unmuteTrack(label) : E.muteTrack(label)}
            isDisabled={!editable}
            onPress={() =>
              update(
                { muted: !track.muted },
                track.muted ? EditLabel.unmuteTrack() : EditLabel.muteTrack(),
              )
            }
          >
            {track.muted ? <VolumeOff /> : <VolumeTwo />}
          </HeaderToggle>
        ) : null}
        <HeaderToggle
          label={track.locked ? E.unlockTrack(label) : E.lockTrack(label)}
          isDisabled={!editable}
          onPress={() =>
            update(
              { locked: !track.locked },
              track.locked ? EditLabel.unlockTrack() : EditLabel.lockTrack(),
            )
          }
        >
          {track.locked ? <Lock /> : <LockOpen />}
        </HeaderToggle>
        {menu}
      </span>
    </div>
  );
}

function HeaderToggle({
  label,
  isDisabled,
  onPress,
  children,
}: {
  label: string;
  isDisabled: boolean;
  onPress(): void;
  children: ReactNode;
}) {
  return (
    <TooltipTrigger>
      <ActionButton
        isQuiet
        size="XS"
        aria-label={label}
        isDisabled={isDisabled}
        onPress={onPress}
      >
        {children}
      </ActionButton>
      <Tooltip>{label}</Tooltip>
    </TooltipTrigger>
  );
}
