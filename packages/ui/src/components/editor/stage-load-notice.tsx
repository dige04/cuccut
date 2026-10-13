import { useEffect, useState, type SyntheticEvent } from 'react';
import type { Id } from '@cuccut/protocol';
import { Button, ProgressBar, ProgressCircle } from '@react-spectrum/s2';
import AlertTriangle from '@react-spectrum/s2/icons/AlertTriangle';
import { iconStyle, style } from '@react-spectrum/s2/style' with { type: 'macro' };
import { useRuntime } from '../../runtime/context.tsx';
import type { MediaPreparation } from '../../runtime/media-url-cache.ts';
import { useVideo } from '../../state/video-store.ts';
import { EDITOR_COPY as E } from './editor-copy.ts';
import type { PreviewEngine, PreviewStatus } from './preview-engine.ts';
import { SPINNER_DELAY_MS, preparePercent, stallDetail, stallTopic, waitedSeconds } from './preview-stall.ts';
import type { StallReport } from './preview-watch.ts';

/**
 * Covers the whole picture and captures the pointer (design draft `.stageload`). At this moment there is nothing on the canvas, so clicks on the black block cannot select, and marquee selection cannot reach hidden elements below.
 * The area behind the picture is always black, and panels and cards are always dark: they do not flip with the light/dark theme.
 */
const layer = style({
  position: 'absolute',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  padding: 16,
  boxSizing: 'border-box',
  borderRadius: 'sm',
  backgroundColor: 'black',
  pointerEvents: 'auto',
  cursor: 'default',
});
const busy = style({ display: 'flex', alignItems: 'center', gap: 8, font: 'ui-sm', color: 'transparent-white-700' });
/** Converting (design draft `.stageload__prep`): not a card. A title, a progress bar, and which media is being converted, shown once in a centered column. The text hierarchy is the same as a card's. */
const prep = style({
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  gap: 8,
  maxWidth: 440,
  font: 'ui-sm',
  color: 'transparent-white-800',
  textAlign: 'center',
  overflowWrap: 'anywhere',
});
const prepTitle = style({ font: 'title-sm', color: 'white' });
/** The title does not jump in width as the percentage changes (the style macro has no `font-variant-numeric`). */
const tabular = { fontVariantNumeric: 'tabular-nums' } as const;
const bar = style({ width: 240, maxWidth: 'full' });
/** Looks the same as the “主媒体放不出来”(main media cannot be played) card (stage-media-notice.tsx), with one extra row for a button. */
const card = style({
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'start',
  gap: 4,
  maxWidth: 440,
  paddingX: 16,
  paddingY: 12,
  borderRadius: 'lg',
  backgroundColor: 'transparent-white-100',
  // The `font` shorthand sets a color of its own, so the color must be written after it.
  font: 'ui-sm',
  color: 'transparent-white-800',
  overflowWrap: 'anywhere',
});
const title = style({ display: 'flex', alignItems: 'center', gap: 8, font: 'title-sm', color: 'white' });
const step = style({ color: 'transparent-white-900' });
const action = style({ marginTop: 4 });

/** Pointer down, click, double-click and right-click no longer bubble up (this stops stage and editor selection and deselection). The “重试”(retry) button on the card is handled before this and remains clickable as usual. */
const swallow = (event: SyntheticEvent) => event.stopPropagation();
const block = { onPointerDown: swallow, onMouseDown: swallow, onClick: swallow, onDoubleClick: swallow, onContextMenu: swallow };

/**
 * Preview loading and stuck state (product design §5.1, design draft stage-load.jsx). Until the picture appears (the render kernel is still loading, or the media for this moment is not ready yet), it is an opaque dark panel that does not show the black frames of waiting for media; the spinner appears only after `SPINNER_DELAY_MS`.
 * When media must be converted before it can play (the Runtime is preparing a compatible copy), it switches to “正在准备预览 · N%”(preparing preview · N%) with a progress bar, naming which media is being converted.
 * When stuck (the preview engine's stuck diagnostic reports it and the page is visible), a card appears in the middle of the picture, saying which step it is stuck on and how many seconds it has waited, with a “重试”(retry) button.
 * `suppressed`: when main media cannot be played there is already a dedicated card, so no second card is stacked, and the wait no longer covers the picture.
 */
export function StageLoadNotice({
  engine,
  videoId,
  status,
  frame,
  suppressed,
  onRetry,
}: {
  engine: PreviewEngine;
  videoId: Id | null;
  status: PreviewStatus;
  frame: { left: number; top: number; width: number; height: number };
  suppressed: boolean;
  onRetry(): void;
}) {
  const stall = usePreviewStall(engine);
  const pictured = usePictured(engine);
  const preparing = usePreparing(videoId);
  const waiting = status.kind === 'loading' || (status.kind === 'ready' && !pictured && !suppressed);
  // For the first brief moment it is just a quiet dark panel: openings that finish quickly (including short clips that convert quickly) do not flash a spinner or progress bar.
  const shown = useDelayed(waiting, SPINNER_DELAY_MS);
  if (stall && !suppressed) return <StallCard stall={stall} frame={frame} onRetry={onRetry} />;
  if (!waiting) return null;
  const converting = shown ? preparing[0] : undefined;
  if (converting) return <PreparingPanel preparation={converting} frame={frame} />;
  return (
    <div className={layer} style={frame} role="status" aria-label={E.stall.loading} data-preview-load="loading" {...block}>
      {shown ? (
        <div className={busy}>
          <ProgressCircle size="S" isIndeterminate staticColor="white" aria-label={E.stall.loading} />
          <span>{E.stall.loading}</span>
        </div>
      ) : null}
    </div>
  );
}

/** Converting: the percentage is rounded down and capped at 99. While the Runtime does not yet know the progress, only the title shows and the progress bar is indeterminate. */
function PreparingPanel({ preparation, frame }: { preparation: MediaPreparation; frame: { left: number; top: number; width: number; height: number } }) {
  const name = useVideo((s) => s.video?.state?.video?.assets[preparation.assetId]?.name?.trim() || null);
  const percent = preparePercent(preparation.progress);
  const label = percent === null ? E.stall.preparing : `${E.stall.preparing} · ${percent}%`;
  return (
    <div className={layer} style={frame} role="status" aria-label={label} data-preview-load="preparing" {...block}>
      <div className={prep}>
        <div className={prepTitle} style={tabular}>
          {label}
        </div>
        <ProgressBar
          size="S"
          staticColor="white"
          aria-label={E.stall.preparing}
          value={percent ?? 0}
          isIndeterminate={percent === null}
          styles={bar}
        />
        <div className={step}>{name ? E.stall.converting(name) : E.stall.convertingUnnamed}</div>
        <div>{E.stall.once}</div>
      </div>
    </div>
  );
}

function StallCard({ stall, frame, onRetry }: { stall: StallReport; frame: { left: number; top: number; width: number; height: number }; onRetry(): void }) {
  const video = useVideo((s) => s.video?.state?.video ?? null);
  const [now, setNow] = useState(() => performance.now());
  // “已经等了 N 秒”(waited N seconds) updates every second.
  useEffect(() => {
    const timer = setInterval(() => setNow(performance.now()), 1000);
    return () => clearInterval(timer);
  }, []);
  const detail = stallDetail(stall, {
    asset: (id) => video?.assets[id]?.name,
    document: (id) => video?.documents?.[id]?.name,
  });
  return (
    <div className={layer} style={frame} role="alert" data-preview-load="stalled" data-preview-stall={stallTopic(stall.step)} {...block}>
      <div className={card}>
        <div className={title}>
          <AlertTriangle styles={iconStyle({ size: 'S', color: 'notice' })} />
          {E.stall.title}
        </div>
        <div className={step}>{detail}</div>
        <div>{E.stall.body(waitedSeconds(stall, Math.max(now, stall.since + stall.stalledMs)))}</div>
        <div className={action}>
          <Button variant="secondary" staticColor="white" size="S" onPress={onRetry}>
            {E.retry}
          </Button>
        </div>
      </div>
    </div>
  );
}

/** The stuck segment (the preview engine's stuck diagnostic). Not shown while the page is hidden (the timer restarts after the diagnostic comes back). */
function usePreviewStall(engine: PreviewEngine): StallReport | null {
  const [stall, setStall] = useState<StallReport | null>(() => engine.stall);
  const [visible, setVisible] = useState(() => typeof document === 'undefined' || document.visibilityState !== 'hidden');
  useEffect(() => engine.onStall(setStall), [engine]);
  useEffect(() => {
    const update = () => setVisible(document.visibilityState !== 'hidden');
    document.addEventListener('visibilitychange', update);
    return () => document.removeEventListener('visibilitychange', update);
  }, []);
  return visible ? stall : null;
}

/** Whether the picture has ever appeared (the preview engine's `pictured`). */
function usePictured(engine: PreviewEngine): boolean {
  const [pictured, setPictured] = useState(() => engine.pictured);
  useEffect(() => engine.onPicture(setPictured), [engine]);
  return pictured;
}

/** The media this video is waiting on for compatible copies (the Runtime is converting), ordered by when conversion started; progress updates as it changes. */
function usePreparing(videoId: Id | null): MediaPreparation[] {
  const mediaUrls = useRuntime().videos.mediaUrls;
  const [preparing, setPreparing] = useState<MediaPreparation[]>(() => (videoId ? mediaUrls.preparing(videoId) : []));
  useEffect(() => {
    const update = () => setPreparing(videoId ? mediaUrls.preparing(videoId) : []);
    update();
    return mediaUrls.subscribe(update);
  }, [mediaUrls, videoId]);
  return preparing;
}

/** `on` only becomes true after it has stayed true continuously for `ms` (fast loads do not flicker). */
function useDelayed(on: boolean, ms: number): boolean {
  const [late, setLate] = useState(false);
  useEffect(() => {
    setLate(false);
    if (!on) return;
    const timer = setTimeout(() => setLate(true), ms);
    return () => clearTimeout(timer);
  }, [on, ms]);
  return on && late;
}
