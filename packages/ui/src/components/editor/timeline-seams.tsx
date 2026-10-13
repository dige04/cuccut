import { useCallback, useEffect, useMemo, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react';
import type { AssetRecord, DocumentRecord, Id, Sequence } from '@cuccut/protocol';
import { ToastQueue, Tooltip, TooltipTrigger } from '@react-spectrum/s2';
import { style } from '@react-spectrum/s2/style' with { type: 'macro' };
import { Button as RACButton } from 'react-aria-components';
import {
  bandRestore,
  bandWordMarks,
  cutBands,
  cutText,
  dragBandEdge,
  retimeOperations,
  type BandDrag,
  type CutBand,
} from '../../model/cut-bands.ts';
import { readSpeechWords, type SpeechWord } from '../../model/speech-cues.ts';
import { spanIndex, spansIn } from '../../model/timeline-window.ts';
import { cutSetRecord, readCutSet, type TrackedCut } from '../../model/transcript-cut.ts';
import { CUT_BAND_COPY as C } from './cut-band-copy.ts';
import { useEditorActions } from './editor-context.tsx';
import { useDocumentBody } from './use-document-body.ts';
import { mediaCandidates } from './transcribe-run.ts';
import { applyRestore, applyRetime } from './transcript-actions.ts';
import { TRANSCRIPT_COPY } from './transcript-copy.ts';

/**
 * Cut bands on the timeline (prototype timeline-cutbands.jsx): cuts are global, running through all tracks like the playhead, with one band per cut (a video and its linked audio cut at the same point are merged into one band). Hovering says what was cut and how long; clicking restores; dragging the two edges changes the cut range.
 *
 * The timeline is the finished output, and cut content takes no time, so bands are not drawn at the width of the removed original length (that would cover the kept content). Instead, each cut gets a fixed-width striped band. When an edge is dragged, the band scales with the new range: the extra cut covers the footage that is to be removed, and when cutting less it narrows proportionally, and reaching zero width means restore.
 * The drag rules (snap to word boundaries, Alt for free movement, clamping) and the transaction it generates are in model/cut-bands.ts.
 */

/** Band width at rest (pixels). */
const REST_W = 16;
/** Width of the hit area on each edge (inside the band; when the band is narrow, each side shrinks to a third of the band width, leaving the middle for click-to-restore). */
const EDGE_PX = 6;
/** Moving more than this many pixels after pressing counts as a drag. */
const DRAG_PX = 3;
const MAC = typeof navigator !== 'undefined' && /Mac/.test(navigator.platform);
const NO_WORDS: SpeechWord[] = [];
const NO_CUTS: TrackedCut[] = [];

const bandStyle = style({
  position: 'absolute',
  zIndex: 1,
  boxSizing: 'border-box',
  display: 'block',
  padding: 0,
  borderWidth: 0,
  borderRadius: 'none',
  overflow: 'hidden',
  cursor: { default: 'pointer', isDisabled: 'default' },
  outlineStyle: { default: 'none', isFocusVisible: 'solid' },
  outlineColor: 'focus-ring',
  outlineWidth: 2,
  // The stripes, seam lines, and edge colors are in editor.css (style macros can't draw gradients or inner shadows); only tokens are given here.
  '--cc-cut-bg': { type: 'backgroundColor', value: 'gray-100' },
  '--cc-cut-bg-hover': { type: 'backgroundColor', value: 'gray-200' },
  '--cc-cut-bg-drag': { type: 'backgroundColor', value: 'blue-100' },
  '--cc-cut-stripe': { type: 'backgroundColor', value: 'gray-300' },
  '--cc-cut-seam': { type: 'backgroundColor', value: 'gray-800' },
  '--cc-cut-edge': { type: 'backgroundColor', value: 'blue-400' },
  '--cc-cut-edge-line': { type: 'backgroundColor', value: 'blue-900' },
});
const tagStyle = style({
  position: 'absolute',
  zIndex: 5,
  font: 'code-xs',
  color: 'gray-25',
  backgroundColor: 'blue-900',
  borderRadius: 'sm',
  paddingX: 4,
  whiteSpace: 'nowrap',
  pointerEvents: 'none',
});
const tipLine = style({ display: 'block' });

/**
 * Cut band layer: mounted in the timeline content layer, after all track rows. `xOfFrame` maps a sequence frame to a content-layer x coordinate (including the header column); `top` / `height` are the top edge and total height of the track area. `frames` is the visible time window (sequence frames; the timeline already includes its left and right margins): only bands inside the window are drawn. Bands being dragged and bands with focus stay even when outside the window (see AssetBands).
 */
export function CutBands({
  sequence,
  assets,
  documents,
  xOfFrame,
  top,
  height,
  pps,
  frames,
  editable,
}: {
  sequence: Sequence;
  assets: Record<Id, AssetRecord>;
  documents: Record<Id, DocumentRecord>;
  xOfFrame(frame: number): number;
  top: number;
  height: number;
  pps: number;
  frames: { from: number; to: number };
  editable: boolean;
}) {
  const bands = useMemo(() => cutBands(sequence), [sequence]);
  const groups = useMemo(() => {
    const byAsset = new Map<Id, CutBand[]>();
    for (const band of bands) {
      const list = byAsset.get(band.assetId);
      if (list) list.push(band);
      else byAsset.set(band.assetId, [band]);
    }
    return byAsset;
  }, [bands]);
  // Each asset uses its latest transcript (same as the transcript panel): used to say which words were cut, and to snap to word boundaries while an edge is dragged.
  const speeches = useMemo(
    () => (groups.size ? new Map(mediaCandidates(sequence, assets, documents).map((candidate) => [candidate.asset.id, candidate.speech])) : null),
    [groups, sequence, assets, documents],
  );
  if (!groups.size) return null;
  const shared = { sequence, assets, xOfFrame, top, height, pps, editable };
  // The band is REST_W wide, centered on the cut; the window is widened on each side by one band's width.
  const slack = (REST_W / pps) * (sequence.fps.num / sequence.fps.den);
  return (
    <>
      {[...groups].map(([assetId, list]) => (
        <AssetBands
          key={assetId}
          bands={list}
          from={frames.from - slack}
          to={frames.to + slack}
          speech={speeches?.get(assetId) ?? undefined}
          cutSet={cutSetRecord(documents, assetId)}
          {...shared}
        />
      ))}
    </>
  );
}

interface BandProps {
  sequence: Sequence;
  assets: Record<Id, AssetRecord>;
  xOfFrame(frame: number): number;
  top: number;
  height: number;
  pps: number;
  editable: boolean;
}

function AssetBands({
  bands,
  from,
  to,
  speech,
  cutSet,
  ...props
}: BandProps & { bands: CutBand[]; from: number; to: number; speech: DocumentRecord | undefined; cutSet: DocumentRecord | undefined }) {
  const body = useDocumentBody(speech);
  const words = useMemo(() => (body === undefined ? NO_WORDS : (readSpeechWords(body)?.words ?? NO_WORDS)), [body]);
  // The set of cuts for an asset: restore and change-range find the cut that covers the seam through this set.
  const cutBody = useDocumentBody(cutSet);
  const cuts = useMemo(() => (cutBody === undefined ? NO_CUTS : (readCutSet(cutBody) ?? NO_CUTS)), [cutBody]);
  // Sorted by cut position; only bands inside the window are drawn. Pinned bands (an edge being dragged with the pointer held, or keyboard focus on the band) are still drawn: unmounting them would tear down the drag listeners (that cancels the drag) and drop focus.
  // The most recently pinned band (remembered even after blur and release, until another band is pinned), plus the one before and after it, are also drawn: when focus is on a band that has scrolled out of the window, Tab / Shift+Tab goes to the adjacent band, rather than jumping to the first band in the window and skipping any in between that weren't mounted. It is not released on blur: blur happens before the new band gets focus, and by then the neighbors would be unmounted and focus would be lost.
  const index = useMemo(() => spanIndex(bands, (band) => ({ start: band.frame, end: band.frame })), [bands]);
  const position = useMemo(() => new Map(bands.map((band, i) => [band.key, i])), [bands]);
  const [held, setHeld] = useState<ReadonlySet<string>>(() => new Set());
  const [recent, setRecent] = useState<string | null>(null);
  const hold = useCallback((key: string, on: boolean) => {
    if (on) setRecent(key);
    setHeld((current) => {
      if (current.has(key) === on) return current;
      const next = new Set(current);
      if (on) next.add(key);
      else next.delete(key);
      return next;
    });
  }, []);
  const pinned: CutBand[] = [];
  for (const key of held) {
    const i = position.get(key);
    if (i !== undefined) pinned.push(bands[i]!);
  }
  const at = recent === null ? undefined : position.get(recent);
  if (at !== undefined) pinned.push(...bands.slice(Math.max(0, at - 1), at + 2));
  const shown = spansIn(index, from, to, pinned);
  return (
    <>
      {shown.map((band) => (
        <Band key={band.key} band={band} words={words} cuts={cuts} onHold={hold} {...props} />
      ))}
    </>
  );
}

function Band({
  band,
  words,
  cuts,
  sequence,
  assets,
  xOfFrame,
  top,
  height,
  pps,
  editable,
  onHold,
}: BandProps & {
  band: CutBand;
  words: readonly SpeechWord[];
  cuts: readonly TrackedCut[];
  /** Whether this band should be pinned (not unmounted when it scrolls out of the window). */
  onHold(key: string, on: boolean): void;
}) {
  const actions = useEditorActions();
  const [drag, setDrag] = useState<BandDrag | null>(null);
  const [tip, setTip] = useState(false);
  // An in-progress drag: on unmount, remove the listeners attached to window.
  const live = useRef<(() => void) | null>(null);
  useEffect(() => () => live.current?.(), []);
  // From pressing an edge (listeners attached, but `drag` is still null until the pointer has moved DRAG_PX) until release, and while keyboard focus is on the band, ask the parent to pin this one.
  const [grabbed, setGrabbed] = useState(false);
  const [focused, setFocused] = useState(false);
  const pinned = grabbed || focused;
  useEffect(() => {
    if (!pinned) return;
    onHold(band.key, true);
    return () => onHold(band.key, false);
  }, [pinned, band.key, onHold]);
  const fps = sequence.fps;
  const perSecond = fps.num / fps.den;
  const seconds = band.frames / perSecond;
  const text = useMemo(() => cutText(words, band.from, band.to), [words, band.from, band.to]);

  // Geometry: at rest, REST_W wide, centered on the cut. While dragging, the extra cut extends outward in proportion to the timeline, and the originally cut portion narrows in proportion.
  const x = xOfFrame(band.frame);
  let left = x - REST_W / 2;
  let right = x + REST_W / 2;
  if (drag?.changed) {
    const ppf = pps / perSecond;
    const span = Math.max(1, band.frames);
    left = drag.start <= 0 ? left + drag.start * ppf : left + (REST_W * Math.min(drag.start, span)) / span;
    right = drag.end >= band.frames ? right + (drag.end - band.frames) * ppf : right - (REST_W * (band.frames - drag.end)) / span;
  }
  const width = Math.max(2, right - left);
  if (right - left < 2) left = (left + right) / 2 - 1;
  const edgeWidth = Math.max(2, Math.min(EDGE_PX, Math.floor(width / 3)));

  const begin = (event: ReactPointerEvent<HTMLSpanElement>, edge: 'start' | 'end') => {
    if (event.button !== 0) return;
    // Don't let a press land on the band body (that is restore), on a clip, or on empty timeline space (that clears the selection).
    event.preventDefault();
    event.stopPropagation();
    setTip(false);
    if (!editable || live.current) return;
    // Changing the range first needs this spot to be restorable, and the spot must be exactly where a cut was made: try dragging an empty range to test.
    const probe = retimeOperations(sequence, assets, band, cuts, { start: 0, end: 0 });
    const marks = bandWordMarks(band, words, fps);
    const pressX = event.clientX;
    const root = document.documentElement;
    let started = false;
    let dx = 0;
    let free = false;
    let last: BandDrag | null = null;
    const update = () => {
      last = dragBandEdge(band, marks, edge, (dx / pps) * perSecond, free, fps);
      setDrag(last);
    };
    const detach = () => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
      window.removeEventListener('pointercancel', detach);
      window.removeEventListener('keydown', key, true);
      window.removeEventListener('keyup', key, true);
      root.classList.remove('cc-col-resize');
      live.current = null;
      setDrag(null);
      setGrabbed(false);
    };
    const move = (ev: PointerEvent) => {
      // Released in another window: discard it, don't commit.
      if (ev.buttons === 0) return detach();
      dx = ev.clientX - pressX;
      free = ev.altKey;
      if (!started) {
        if (Math.abs(dx) <= DRAG_PX) return;
        started = true;
        if (probe && !probe.ok) {
          // If this spot can't be restored, changing the range (restore, then cut) can't be done either: say why plainly.
          ToastQueue.neutral(TRANSCRIPT_COPY.restoreRefused[probe.reason], { timeout: 6000 });
          return detach();
        }
        root.classList.add('cc-col-resize');
      }
      update();
    };
    const up = (ev: PointerEvent) => {
      // The release position also counts as a move: when dragging fast, the last segment may only appear in pointerup.
      if (started) {
        dx = ev.clientX - pressX;
        free = ev.altKey;
        update();
      }
      const done: BandDrag | null = started ? last : null;
      detach();
      if (done?.changed) void applyRetime(actions, retimeOperations(sequence, assets, band, cuts, done), fps, seconds);
    };
    // Esc cancels (ahead of the editor's own Esc). Pressing or releasing Alt during a drag switches the snapping mode immediately.
    const key = (ev: KeyboardEvent) => {
      if (ev.key === 'Escape' && ev.type === 'keydown') {
        ev.preventDefault();
        ev.stopImmediatePropagation();
        detach();
      } else if (ev.key === 'Alt' && started) {
        ev.preventDefault();
        free = ev.type === 'keydown';
        update();
      }
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
    window.addEventListener('pointercancel', detach);
    window.addEventListener('keydown', key, true);
    window.addEventListener('keyup', key, true);
    live.current = detach;
    setGrabbed(true);
  };

  const edgeEl = (edge: 'start' | 'end') => (
    <span
      className="cc-cut-edge"
      data-edge={edge}
      data-on={drag?.changed && drag.edge === edge ? '' : undefined}
      style={{ width: edgeWidth }}
      aria-hidden
      onPointerDown={(event) => begin(event, edge)}
    />
  );

  const changed = drag?.changed ? drag : null;
  const frames = changed ? changed.end - changed.start : 0;
  return (
    <>
      <TooltipTrigger delay={300} isOpen={tip && !drag} onOpenChange={setTip}>
        <RACButton
          className={(renderProps) => `${bandStyle(renderProps)} cc-cut-band`}
          style={{ left, width, top, height }}
          data-drag={changed ? '' : undefined}
          aria-label={C.label(seconds, text)}
          isDisabled={!editable}
          onFocusChange={setFocused}
          onPress={() => void applyRestore(actions, bandRestore(sequence, band, cuts))}>
          {editable ? edgeEl('start') : null}
          {editable ? edgeEl('end') : null}
        </RACButton>
        <Tooltip>
          <span className={tipLine}>{C.cut(seconds, text)}</span>
          {editable ? <span className={tipLine}>{C.hint(MAC)}</span> : null}
        </Tooltip>
      </TooltipTrigger>
      {changed ? (
        <span className={tagStyle} style={{ left: left + width / 2, top: top + 2, transform: 'translateX(-50%)' }}>
          {frames < 1 ? C.tagRestore : C.tag(frames / perSecond, changed.edge, changed.word?.text ?? null)}
        </span>
      ) : null}
    </>
  );
}
