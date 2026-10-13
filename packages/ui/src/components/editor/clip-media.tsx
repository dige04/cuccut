import { useLayoutEffect, useMemo, useRef, useSyncExternalStore, type ReactNode, type RefObject } from 'react';
import { mediaTimeToSeconds, type AssetRevision, type VideoItem } from '@cuccut/protocol';
import { style } from '@react-spectrum/s2/style' with { type: 'macro' };
import { filmstripTiles, sourceClock, waveEnvelope } from '../../model/clip-media.ts';
import { useRuntime } from '../../runtime/context.tsx';
import { useVisibleLane } from './use-visible-lane.ts';

/** Height of the waveform band (px). */
const WAVE_BAND = 16;
/** Height of the waveform canvas: 2px above and below the waveform band. Written as a constant so drawing does not have to measure it (when a thousand clips are mounted at once, measuring each one would make the browser reflow one by one). */
const WAVE_HEIGHT = WAVE_BAND - 4;
/** The waveform takes a point every this many pixels. */
const WAVE_STEP = 2;

const layer = style({ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', pointerEvents: 'none' });
const film = style({ position: 'relative', flexGrow: 1, minHeight: 0, overflow: 'hidden' });
const tile = style({
  position: 'absolute',
  top: 0,
  bottom: 0,
  boxSizing: 'border-box',
  backgroundSize: 'cover',
  backgroundPosition: 'center',
  backgroundRepeat: 'no-repeat',
  borderEndWidth: 1,
  borderTopWidth: 0,
  borderBottomWidth: 0,
  borderStartWidth: 0,
  borderStyle: 'solid',
  borderColor: 'transparent-black-200',
});
const band = style({
  position: 'relative',
  flexShrink: 0,
  overflow: 'hidden',
  backgroundColor: { default: 'yellow-300', isSelected: 'yellow-400' },
  borderTopWidth: 1,
  borderBottomWidth: 0,
  borderStartWidth: 0,
  borderEndWidth: 0,
  borderStyle: 'solid',
  borderColor: { default: 'yellow-400', isSelected: 'yellow-800' },
});
// The canvas is a replaced element: top and bottom alone do not size it, so the height must be stated (`WAVE_HEIGHT`, written in style).
const wave = style({
  position: 'absolute',
  top: 2,
  color: 'yellow-900',
  opacity: { default: 1, isMuted: 0.35 },
});
const titleChip = style({
  position: 'absolute',
  top: 4,
  insetStart: 4,
  maxWidth: 'calc(100% - 8px)',
  boxSizing: 'border-box',
  display: 'flex',
  alignItems: 'center',
  paddingX: 4,
  borderRadius: 'sm',
  backgroundColor: 'transparent-black-600',
  color: 'white',
  '--iconPrimary': { type: 'fill', value: 'currentColor' },
});

/**
 * The film strip and waveform band in a video clip (same as `ElementMedia` in the old web timeline). The frames and peaks are computed by the Runtime with ffmpeg (`media.thumbnail`, `media.peaks`); here only the visible ones are fetched. The clip name is overlaid on the top-left corner of the film strip. It takes no pointer events: dragging and trimming still land on the clip.
 */
export function ClipMedia({
  videoId,
  item,
  record,
  clipLeft,
  clipWidth,
  clipStart,
  contentStart,
  pxPerSecond,
  scrollRef,
  head,
  selected,
  muted,
  title,
}: {
  videoId: string | null;
  item: VideoItem;
  /** The asset version the instance references; before it is in the snapshot, only the clip name is drawn. */
  record: AssetRevision | undefined;
  /** The clip's position and width within the track content (px). */
  clipLeft: number;
  clipWidth: number;
  /** The sequence time (seconds) at the clip's left edge. */
  clipStart: number;
  /** The sequence time (seconds) at which the instance content starts: follows the clip when dragged, does not move when the start is trimmed. */
  contentStart: number;
  pxPerSecond: number;
  scrollRef: RefObject<HTMLDivElement | null>;
  head: number;
  selected: boolean;
  muted: boolean;
  title: ReactNode;
}) {
  const media = useRuntime().videos.media;
  useSyncExternalStore(media.subscribe, media.version);
  const view = useVisibleLane(scrollRef, head, 0);
  const clock = useMemo(() => sourceClock(item.timeMap, contentStart), [item.timeMap, contentStart]);
  const asset = item.assetRef;
  const sourceDuration = record?.duration ? mediaTimeToSeconds(record.duration) : null;

  const tiles =
    videoId && record?.video
      ? filmstripTiles({ clipLeft, clipWidth, clipStart, pxPerSecond, clock, sourceDuration, view }).map((t) => ({
          ...t,
          url: media.thumbnail(asset, t.at),
        }))
      : [];

  // A freeze frame has no sound; when the source has no sound, the waveform band is not drawn and the film strip fills the space.
  const hasWave = !!videoId && !!record?.audio && clock.kind === 'linear';
  const peaks = hasWave ? media.peaks(asset) : null;
  const ready = peaks?.state === 'ready' ? peaks.value : null;
  const canvasLeft = Math.max(clipLeft, view.left);
  const canvasWidth = Math.max(0, Math.round(Math.min(clipLeft + clipWidth, view.right) - canvasLeft));
  // Thumbnails arrive gradually and cause redraws; the envelope is recomputed only when position, scale or peaks change.
  const points = useMemo(
    () =>
      ready
        ? waveEnvelope({
            canvasLeft,
            width: canvasWidth,
            step: WAVE_STEP,
            clipLeft,
            clipStart,
            pxPerSecond,
            clock,
            peaks: ready.peaks,
            binsPerSecond: ready.binsPerSecond,
            scale: ready.scale,
          })
        : [],
    [ready, canvasLeft, canvasWidth, clipLeft, clipStart, pxPerSecond, clock],
  );

  return (
    <div className={layer}>
      <div className={film}>
        {tiles.map((t) => (
          <i
            key={t.index}
            className={tile}
            style={{ left: t.left, width: t.width, backgroundImage: t.url ? `url(${t.url})` : undefined }}
          />
        ))}
        {title ? <span className={titleChip}>{title}</span> : null}
      </div>
      {hasWave ? (
        <div className={band({ isSelected: selected })} style={{ height: WAVE_BAND }}>
          {points.length > 1 ? <WaveCanvas left={canvasLeft - clipLeft} width={canvasWidth} muted={muted} points={points} /> : null}
        </div>
      ) : null}
    </div>
  );
}

/** Peak envelope: filled symmetrically up and down. The color is the canvas's own `color`, which changes with the theme. */
function WaveCanvas({ left, width, muted, points }: { left: number; width: number; muted: boolean; points: number[] }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useLayoutEffect(() => {
    const canvas = ref.current;
    const height = WAVE_HEIGHT;
    const context = canvas?.getContext('2d');
    if (!canvas || !context) return;
    const dpr = window.devicePixelRatio || 1;
    canvas.width = Math.round(width * dpr);
    canvas.height = Math.round(height * dpr);
    context.setTransform(dpr, 0, 0, dpr, 0, 0);
    context.clearRect(0, 0, width, height);
    if (points.length < 2) return;
    const mid = height / 2;
    const half = (amplitude: number) => Math.max(0.5, (amplitude * height) / 2);
    context.fillStyle = getComputedStyle(canvas).color;
    context.beginPath();
    points.forEach((amplitude, k) => context.lineTo(Math.min(width, k * WAVE_STEP), mid - half(amplitude)));
    for (let k = points.length - 1; k >= 0; k--) context.lineTo(Math.min(width, k * WAVE_STEP), mid + half(points[k]!));
    context.closePath();
    context.fill();
  }, [width, points]);
  return <canvas ref={ref} className={wave({ isMuted: muted })} style={{ left, width, height: WAVE_HEIGHT }} aria-hidden />;
}
