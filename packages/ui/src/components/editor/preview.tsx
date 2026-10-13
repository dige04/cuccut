import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type SyntheticEvent,
} from "react";
import {
  itemRangeSeconds,
  type AssetRecord,
  type AudioItem,
  type DocumentRecord,
  type Id,
  type Sequence,
  type VersionRef,
} from "@cuccut/protocol";
import {
  Content,
  ContextualHelp,
  Heading,
  StatusLight,
} from "@react-spectrum/s2";
import { style } from "@react-spectrum/s2/style" with { type: "macro" };
import { videoSlots } from "../../model/editor.ts";
import { isPortrait } from "../../model/stage-bar.ts";
import type { MediaOutcome } from "../../model/stage-media.ts";
import { useRuntime } from "../../runtime/context.tsx";
import { useEditor } from "../../state/editor-store.ts";
import { useEditorActions } from "./editor-context.tsx";
import {
  FullscreenPlayer,
  exitPreviewFullscreen,
} from "./fullscreen-player.tsx";
import {
  audioKey,
  imageKey,
  videoKey,
  type MediaKey,
  type PreviewStatus,
} from "./preview-engine.ts";
import { StageLoadNotice } from "./stage-load-notice.tsx";
import { StageMediaNotice } from "./stage-media-notice.tsx";
import { SafeAreaOverlay } from "./stage-bar.tsx";
import { ToolbarRowContext } from "./toolbar-row.ts";
import { EDITOR_LAYOUT_COPY as L } from "./editor-layout-copy.ts";
import { StageObjects } from "./stage-objects.tsx";
import { useAssetUrl } from "./use-asset-url.ts";
import { useStageMedia } from "./use-stage-media.ts";
import { EDITOR_COPY as E } from "./editor-copy.ts";

const wrap = style({
  display: "flex",
  flexDirection: "column",
  flexGrow: 1,
  minHeight: 0,
  minWidth: 0,
});
const problemsAt = style({
  display: "flex",
  alignItems: "center",
  gap: 2,
  flexShrink: 0,
});
const problemList = style({ margin: 0, paddingStart: 16 });
/** The stage: in full screen the whole of it goes into the browser's full screen (`enterPreviewFullscreen`), black around the picture. */
const stage = style({
  position: "relative",
  flexGrow: 1,
  minHeight: 0,
  backgroundColor: { default: "transparent", isFullscreen: "black" },
});
/** The picture in agentcut's frame (FRAME: rounded-3xl, black, a faint ring); edge to edge in full screen. */
const frame = style({
  position: "absolute",
  overflow: "hidden",
  borderRadius: { default: "[24px]", isFullscreen: "none" },
  backgroundColor: "black",
  boxShadow: {
    default: "[0 0 0 1px rgb(255 255 255 / 0.1)]",
    isFullscreen: "none",
  },
});
const surface = style({
  position: "absolute",
  inset: 0,
  width: "full",
  height: "full",
});
/** Source element is not shown; it only supplies frames to the canvas. Not display: none, so the browser still decodes it. */
const sources = style({
  position: "absolute",
  top: 0,
  insetStart: 0,
  width: 2,
  height: 2,
  overflow: "hidden",
  opacity: 0,
  pointerEvents: "none",
});
const empty = style({
  position: "absolute",
  inset: 0,
  display: "flex",
  flexDirection: "column",
  alignItems: "center",
  justifyContent: "center",
  gap: 4,
  font: "ui",
  color: "gray-400",
  textAlign: "center",
  pointerEvents: "none",
});
const notice = style({ font: "ui-xs", color: "gray-400" });

/** Room around the frame for the selection's handles and rotate knob. */
const PADDING = 16;
/** Height kept under the frame for the toolbar row (agentcut's TOOLBAR_ROW), which follows the frame's bottom edge. */
const ROW_HEIGHT = 52;

/**
 * Source elements for audio instances: each `<audio>` is a media player, and browsers cap how many there can be; thousands (one per sentence of dubbing) would freeze the page. When there are no more than
 * `AUDIO_ALL`, all of them are mounted. When there are more, only those near the playhead are mounted (`AUDIO_BEHIND` seconds back and `AUDIO_AHEAD` seconds ahead, and the window shifts every `AUDIO_STEP` seconds as the playhead moves).
 * Anything played past has already been mounted and loaded. After a seek a long way away, the engine syncs a newly mounted element once it has loaded.
 */
const AUDIO_ALL = 32;
const AUDIO_STEP = 10;
const AUDIO_BEHIND = 10;
const AUDIO_AHEAD = 30;

/**
 * Preview: composites each layer onto the canvas according to the frame plan (WASM computes the plan and draws one frame, using the same render kernel as export), centered on the stage at the canvas's aspect ratio.
 * The stage toolbar (stage-bar.tsx) sits along the bottom edge of the picture. In fullscreen playback (F, or the button at the right end of the toolbar), the whole stage goes into browser fullscreen: the picture is flush to the edges, the stage's pick layer is not drawn, and the fullscreen player (fullscreen-player.tsx) covers it.
 */
export function Preview({
  videoId,
  sequence,
  assets,
  documents,
}: {
  videoId: Id | null;
  sequence: Sequence;
  assets: Record<Id, AssetRecord>;
  documents: Record<Id, DocumentRecord>;
}) {
  const { engine } = useEditorActions();
  const fullscreen = useEditor((s) => s.fullscreen);
  const rate = useEditor((s) => s.rate);
  const captionsHidden = useEditor((s) => s.captionsHidden);
  const safeArea = useEditor((s) => s.safeArea);
  const [status, setStatus] = useState<PreviewStatus>({ kind: "loading" });
  const stageRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [box, setBox] = useState({ width: 0, height: 0 });
  const [toolbarRow, setToolbarRow] = useState<HTMLDivElement | null>(null);
  const picked = useEditor((s) => s.selection.length > 0);
  // Main media cannot be played: a persistent card in the middle of the picture. Once it recovers, the source elements are remounted per asset and the address is fetched again.
  const stageMedia = useStageMedia(videoId, sequence);
  // “Retry” when preview is stuck (product design §5.1): the engine reconnects to the render kernel and resubmits the video; this video's media addresses are discarded and requested again, and all source elements are remounted.
  const mediaUrls = useRuntime().videos.mediaUrls;
  const [reload, setReload] = useState(0);
  const retry = useCallback(() => {
    if (videoId) mediaUrls.forgetVideo(videoId);
    engine.retry();
    setReload((n) => n + 1);
  }, [engine, mediaUrls, videoId]);

  useEffect(() => engine.onStatus(setStatus), [engine]);
  // Playback speed and caption visibility are this window's viewing state (editor-store); they are passed to the engine only here. The stage toolbar and the fullscreen player only change the store.
  // The caption level in fullscreen is owned by the fullscreen player; on exit, it is restored from the stage's visibility setting.
  useEffect(() => engine.setRate(rate), [engine, rate]);
  useEffect(() => {
    if (!fullscreen) engine.setCaptionView(captionsHidden ? "off" : null);
  }, [engine, fullscreen, captionsHidden]);
  // Fullscreen state follows the browser's `fullscreenchange`: the browser's own Esc exit does not pass through our keyboard layer.
  // When the preview is unmounted (switching video, leaving the editor) while the stage is still fullscreen, exit fullscreen so no fullscreen is left without a player.
  useEffect(() => {
    const element = stageRef.current;
    const { setFullscreen } = useEditor.getState();
    const sync = () =>
      setFullscreen(!!element && document.fullscreenElement === element);
    document.addEventListener("fullscreenchange", sync);
    return () => {
      document.removeEventListener("fullscreenchange", sync);
      if (element && document.fullscreenElement === element)
        exitPreviewFullscreen();
      setFullscreen(false);
    };
  }, []);
  useEffect(() => {
    engine.attachCanvas(canvasRef.current);
    return () => engine.attachCanvas(null);
  }, [engine]);

  useEffect(() => {
    const element = stageRef.current;
    if (!element) return;
    const observer = new ResizeObserver(([entry]) => {
      const rect = entry?.contentRect;
      if (rect) setBox({ width: rect.width, height: rect.height });
    });
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  const { width: cw, height: ch } = sequence.canvas;
  const padding = fullscreen ? 0 : PADDING;
  const row = fullscreen ? 0 : ROW_HEIGHT;
  const scale = Math.max(
    0,
    Math.min(
      (box.width - padding * 2) / cw,
      (box.height - padding * 2 - row) / ch,
    ),
  );
  const fw = Math.floor(cw * scale);
  const fh = Math.floor(ch * scale);
  // The canvas is drawn at its display size (times the device pixel ratio), never larger than the sequence canvas itself.
  const pixelScale = Math.min(1, scale * (window.devicePixelRatio || 1));
  useEffect(() => engine.setScale(pixelScale), [engine, pixelScale]);

  // Video elements are allocated per asset (as many elements as there are places using it at the same moment); one per asset for images; one per instance on audio tracks (when there are many, only those near the playhead are mounted).
  const visuals = useMemo(() => {
    const videos = videoSlots(sequence).flatMap(({ asset, count }) =>
      Array.from({ length: count }, (_, slot) => ({
        key: videoKey(asset, slot),
        asset,
      })),
    );
    const images = new Map<MediaKey, VersionRef>();
    for (const item of sequence.items)
      if (item.type === "image")
        images.set(imageKey(item.assetRef), item.assetRef);
    return { videos, images: [...images.entries()] };
  }, [sequence]);
  const audioWindow = useEditor((s) => Math.floor(s.playhead / AUDIO_STEP));
  const audios = useMemo(() => {
    let items = sequence.items.filter(
      (item): item is AudioItem => item.type === "audio",
    );
    if (items.length > AUDIO_ALL) {
      const from = audioWindow * AUDIO_STEP - AUDIO_BEHIND;
      const to = (audioWindow + 1) * AUDIO_STEP + AUDIO_AHEAD;
      items = items.filter((item) => {
        const { start, end } = itemRangeSeconds(item, sequence.fps);
        return end > from && start < to;
      });
    }
    return items.map((item) => ({
      key: audioKey(item.id),
      asset: item.assetRef,
    }));
  }, [sequence, audioWindow]);
  const media = { ...visuals, audios };
  // In the pane the frame sits at the top, level with the cards beside it (agentcut), with the toolbar row right under it;
  // a frame limited by the width leaves the spare height below the row. Fullscreen centres the picture.
  const frameRect = {
    left: (box.width - fw) / 2,
    top: fullscreen ? Math.max(0, (box.height - fh) / 2) : padding,
    width: fw,
    height: fh,
  };
  // Hint card on the stage. In fullscreen it sits between the player's picture click layer and its controls (the picture under the card cannot be clicked, but the card's buttons still work).
  const notices =
    fw > 0 && fh > 0 ? (
      <>
        <StageMediaNotice media={stageMedia} frame={frameRect} />
        {/* Loading and stuck overlays sit above the picture and the stage's pick layer, and capture the pointer. */}
        <StageLoadNotice
          engine={engine}
          videoId={videoId}
          status={status}
          frame={frameRect}
          suppressed={stageMedia.notice !== null}
          onRetry={retry}
        />
      </>
    ) : null;

  return (
    <div className={wrap}>
      <div
        ref={stageRef}
        className={stage({ isFullscreen: fullscreen })}
        data-preview-stage
      >
        <div className={frame({ isFullscreen: fullscreen })} style={frameRect}>
          <canvas
            ref={canvasRef}
            className={surface}
            aria-label={E.previewCanvas}
            data-preview-status={status.kind}
          />
          <div className={sources} aria-hidden>
            {media.videos.map(({ key, asset }) => (
              <MediaSource
                key={`${key}#${stageMedia.revived(asset.id)}.${reload}`}
                kind="video"
                mediaKey={key}
                videoId={videoId}
                asset={asset}
                onOutcome={stageMedia.report}
              />
            ))}
            {media.images.map(([key, asset]) => (
              <MediaSource
                key={`${key}#${stageMedia.revived(asset.id)}.${reload}`}
                kind="image"
                mediaKey={key}
                videoId={videoId}
                asset={asset}
              />
            ))}
            {media.audios.map(({ key, asset }) => (
              <MediaSource
                key={`${key}#${stageMedia.revived(asset.id)}.${reload}`}
                kind="audio"
                mediaKey={key}
                videoId={videoId}
                asset={asset}
                onOutcome={stageMedia.report}
              />
            ))}
          </div>
          {status.kind === "error" ? (
            <div className={empty} role="alert">
              <span>{E.previewFailed}</span>
              <span className={notice}>{status.message}</span>
            </div>
          ) : sequence.items.length === 0 ? (
            <div className={empty}>
              <span>{E.emptyDrag}</span>
              <span className={notice}>{E.emptyOr}</span>
            </div>
          ) : null}
          {safeArea && !fullscreen && isPortrait(sequence.canvas) ? (
            <SafeAreaOverlay />
          ) : null}
        </div>
        {fw > 0 && fh > 0 && !fullscreen ? (
          <ToolbarRowContext.Provider value={toolbarRow}>
            <StageObjects sequence={sequence} frame={frameRect} />
          </ToolbarRowContext.Provider>
        ) : null}
        {fullscreen ? (
          <FullscreenPlayer
            stage={stageRef}
            sequence={sequence}
            assets={assets}
            documents={documents}
          >
            {notices}
          </FullscreenPlayer>
        ) : (
          notices
        )}
        {/* agentcut's TOOLBAR_ROW: the selection's controls dock here, under the picture rather than over it. */}
        {fullscreen ? null : (
          <div
            className="cc-toolbar-row pointer-events-none absolute inset-x-0 flex min-h-11 items-center justify-center gap-2 px-2 pt-2 [&>*]:pointer-events-auto"
            style={{ top: frameRect.top + fh }}
          >
            {picked ? null : (
              <p className="cc-toolbar-hint truncate px-2 text-xs text-muted-foreground">
                {L.pickHint}
              </p>
            )}
            <div
              ref={setToolbarRow}
              className="cc-toolbar-host flex min-w-0 max-w-full justify-center"
            />
            {status.kind === "ready" && status.problems ? (
              <Problems problems={status.problems} />
            ) : null}
          </div>
        )}
      </div>
    </div>
  );
}

/** Some things in this frame cannot be drawn. The picture still renders as usual; this explains what was not drawn and why (video format spec §3.7). */
function Problems({ problems }: { problems: string[] }) {
  return (
    <span className={problemsAt}>
      <StatusLight size="S" variant="notice">
        {E.problemsCount(problems.length)}
      </StatusLight>
      <ContextualHelp variant="info" placement="bottom end">
        <Heading>{E.problemsTitle}</Heading>
        <Content>
          <ul className={problemList}>
            {problems.map((problem) => (
              <li key={problem}>{problem}</li>
            ))}
          </ul>
        </Content>
      </ContextualHelp>
    </span>
  );
}

/**
 * A hidden source element, driven by the preview engine. Reading frames goes through CORS (the media channel allows the origin), so the canvas is not “tainted”.
 * When the address has expired (Runtime restart), it reports an error and fetches a new one. Video and audio load results are reported to the stage hints (address cannot be obtained, decoding fails).
 */
function MediaSource({
  kind,
  mediaKey,
  videoId,
  asset,
  onOutcome,
}: {
  kind: "video" | "image" | "audio";
  mediaKey: MediaKey;
  videoId: Id | null;
  asset: VersionRef;
  onOutcome?: (
    mediaKey: MediaKey,
    asset: VersionRef,
    outcome: MediaOutcome,
  ) => void;
}) {
  const { engine } = useEditorActions();
  const { url, error, retry } = useAssetUrl(videoId, asset);
  const [element, setElement] = useState<
    HTMLVideoElement | HTMLImageElement | HTMLAudioElement | null
  >(null);
  useEffect(() => {
    engine.register(mediaKey, element);
    return () => engine.register(mediaKey, null);
  }, [engine, mediaKey, element]);
  const { id, revision } = asset;
  useEffect(() => {
    if (error) onOutcome?.(mediaKey, { id, revision }, { kind: "unresolved" });
  }, [error, onOutcome, mediaKey, id, revision]);
  if (!url) return null;
  if (kind === "image")
    return (
      <img
        ref={setElement}
        src={url}
        crossOrigin="anonymous"
        alt=""
        draggable={false}
        onError={retry}
      />
    );
  const failed = (event: SyntheticEvent<HTMLMediaElement>) => {
    const problem = event.currentTarget.error;
    onOutcome?.(mediaKey, asset, {
      kind: "error",
      code: problem?.code ?? 0,
      message: problem?.message ?? "",
    });
    retry();
  };
  const loaded = () => onOutcome?.(mediaKey, asset, { kind: "loaded" });
  if (kind === "audio")
    return (
      <audio
        ref={setElement}
        src={url}
        crossOrigin="anonymous"
        preload="auto"
        onError={failed}
        onLoadedData={loaded}
      />
    );
  return (
    <video
      ref={setElement}
      src={url}
      crossOrigin="anonymous"
      preload="auto"
      playsInline
      muted
      onError={failed}
      onLoadedData={loaded}
    />
  );
}
