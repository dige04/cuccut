import { useMemo, useState, useSyncExternalStore } from 'react';
import type { Id, MediaHandle } from '@cuccut/protocol';
import { ActionButton, ToastQueue } from '@react-spectrum/s2';
import AlertTriangle from '@react-spectrum/s2/icons/AlertTriangle';
import ChevronRight from '@react-spectrum/s2/icons/ChevronRight';
import Play from '@react-spectrum/s2/icons/Play';
import { style } from '@react-spectrum/s2/style' with { type: 'macro' };
import { Button as RACButton } from 'react-aria-components';
import { OUTPUT_COPY, VIDEO_CARD_COPY } from '../../copy.ts';
import { outputSourceMissing, posterFrame, type ConversationOutput } from '../../model/conversation-outputs.ts';
import { formatClock } from '../../model/format.ts';
import { DESIGN } from '../../model/design-copy.ts';
import { SLIDES } from '../../model/slides-copy.ts';
import { formatBytes, isPlayable, KIND_LABEL } from '../../model/space.ts';
import { videoStatus } from '../../model/video-cards.ts';
import { useRuntime } from '../../runtime/context.tsx';
import { sameTarget } from '../../runtime/video-controller.ts';
import { useJobs } from '../../state/jobs-store.ts';
import { useShell } from '../../state/shell-store.ts';
import { useSpace } from '../../state/space-store.ts';
import { useVideo } from '../../state/video-store.ts';
import { CompactPlayer } from '../media/compact-player.tsx';
import { KIND_ICON } from '../space/space-list.tsx';
import { useEntryThumbnail } from '../use-entry-thumbnail.ts';
import { cardVars, VideoJobRows, VideoStatusBadge } from './video-card-rows.tsx';
import { T } from './thread-copy.ts';

/** A file is a one-line card (prototype apprail.css `.chat-output` :127-134): icon, name and description, and the destination at the end. */
const outputCard = style({
  display: 'flex',
  alignItems: 'center',
  gap: 12,
  flexShrink: 0,
  width: 'full',
  minWidth: 0,
  boxSizing: 'border-box',
  paddingY: 12,
  paddingX: { default: 16, isPopover: 12 },
  borderWidth: 1,
  borderStyle: 'solid',
  borderColor: 'gray-200',
  borderRadius: '[20px]',
  backgroundColor: { default: 'gray-50', isHovered: 'gray-75', isPressed: 'gray-100' },
  textAlign: 'start',
  font: 'ui',
  color: 'gray-900',
  cursor: 'default',
  outlineStyle: { default: 'none', isFocusVisible: 'solid' },
  outlineColor: 'focus-ring',
  outlineWidth: 2,
  outlineOffset: -2,
  '--iconPrimary': { type: 'fill', value: 'currentColor' },
});
const outputIcon = style({
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  flexShrink: 0,
  size: 40,
  borderRadius: 'xl',
  backgroundColor: 'gray-100',
  color: 'gray-700',
});
const outputBody = style({ display: 'flex', flexDirection: 'column', gap: 4, flexGrow: 1, minWidth: 0 });
const outputName = style({ fontWeight: 'bold', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' });
/**
 * A video is a vertical video card (product design §3.2.2, §6.5; prototype apprail.css `.chat-output--movie` :142-155, home-session.jsx `SessionArtifactCard`): a 16:9 picture on top. If it can play, clicking plays it in place in the card; if not, it opens on the right. Below are the name, status word and duration, with an “打开编辑器” (Open in editor) button beside them.
 * Below that, one row for a task still running.
 */
const videoCard = style({
  display: 'flex',
  flexDirection: 'column',
  flexShrink: 0,
  width: 'full',
  maxWidth: 360,
  minWidth: 0,
  boxSizing: 'border-box',
  overflow: 'hidden',
  borderWidth: 1,
  borderStyle: 'solid',
  borderColor: 'gray-200',
  borderRadius: '[20px]',
  backgroundColor: 'gray-50',
  font: 'ui',
  color: 'gray-900',
});
/**
 * The picture area of the video: shows the real frame when there is one; when none can be obtained, shows “暂无缩略图” (No thumbnail); when the source folder is gone, shows “找不到源文件” (Source file not found). The duration is in the bottom-right corner.
 * For a video that can play in the card, a play button appears in the centre when the pointer moves over it or it gets keyboard focus (`cc-vcard-play`, video-cards.css).
 */
const videoPreview = style({
  position: 'relative',
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  justifyContent: 'center',
  gap: 8,
  width: 'full',
  aspectRatio: 'video',
  overflow: 'hidden',
  padding: 0,
  borderWidth: 0,
  backgroundColor: { default: 'gray-75', isHovered: 'gray-100', isPressed: 'gray-200' },
  font: 'ui-sm',
  color: 'gray-600',
  cursor: 'default',
  outlineStyle: { default: 'none', isFocusVisible: 'solid' },
  outlineColor: 'focus-ring',
  outlineWidth: 2,
  outlineOffset: -2,
  '--iconPrimary': { type: 'fill', value: 'currentColor' },
});
const posterImage = style({ position: 'absolute', inset: 0, width: 'full', height: 'full', objectFit: 'cover' });
const playMark = style({
  position: 'absolute',
  top: '[50%]',
  left: '[50%]',
  translateX: '[-50%]',
  translateY: '[-50%]',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  size: 40,
  borderRadius: 'full',
  backgroundColor: 'gray-25',
  color: 'gray-900',
  boxShadow: 'elevated',
});
const videoDuration = style({
  position: 'absolute',
  insetEnd: 8,
  bottom: 8,
  paddingX: '[6px]',
  paddingY: 4,
  borderRadius: 'full',
  backgroundColor: '[rgb(0 0 0 / 0.6)]',
  font: 'code-xs',
  // The `font` shorthand sets the code text colour, so the badge's contrast colour must come after it.
  color: 'white',
});
const videoFooter = style({ display: 'flex', alignItems: 'center', gap: 12, paddingX: 16, paddingY: 12 });
const videoName = style({ fontWeight: 'bold', overflowWrap: 'anywhere' });
const videoMeta = style({ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 8, minWidth: 0 });
const videoAction = style({ flexShrink: 0 });
const outputDetail = style({ font: 'ui-xs', color: 'gray-600', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' });
const outputTail = style({ display: 'flex', flexShrink: 0, color: 'gray-600' });

/**
 * The real frame on the video card uses the Space's cover (`space.thumbnail`, wide enough to draw the card on 2x displays), so the editor does not need to be opened.
 * When the Space has no cover yet and the editor has this video open, the current snapshot's cover is drawn first (`media.thumbnail`, the filmstrip size, a bit blurry).
 * If the cover frame was changed in the editor, the Space's cover catches up once the entry is updated.
 */
function usePoster(output: ConversationOutput): string | null {
  const thumbnail = useEntryThumbnail(output.kind === 'video' ? output.entry : null);
  const media = useRuntime().videos.media;
  useSyncExternalStore(media.subscribe, media.version);
  const target = output.video;
  const snapshot = useVideo((s) =>
    target && s.video?.status === 'ready' && (s.video.videoId === output.id || sameTarget(s.video.target, target))
      ? (s.video.state?.video ?? null)
      : null,
  );
  const frame = useMemo(() => (snapshot ? posterFrame(snapshot) : null), [snapshot]);
  if (thumbnail?.kind === 'image') return thumbnail.url;
  return frame ? media.thumbnail(frame.asset, frame.at) : null;
}

/** When the editor has this video open and the document already has a transcript (`speech`), the video card's “已转录” (Transcribed) does not have to wait for the Job record. */
function useTranscribedInEditor(output: ConversationOutput): boolean {
  const target = output.video;
  return useVideo(
    (s) =>
      output.kind === 'video' &&
      s.video?.status === 'ready' &&
      (s.video.videoId === output.id || (!!target && sameTarget(s.video.target, target))) &&
      Object.values(s.video.state?.video.documents ?? {}).some((doc) => doc.kind === 'speech'),
  );
}

/**
 * One artifact (prototype home-session.jsx `SessionArtifactCard`): shared by the “产物” (Artifacts) popover in the session header, the video card in the thread, and the files under each reply.
 * A video opens in the editor on the right; video files and audio play in the feature area; other files are shown in the folder. `onOpen` is called before opening (the popover uses it to close itself).
 * `jobIds`: the tasks listed under the video card (in the thread and in the popover, these are all the tasks for this whole session on this video).
 */
export function OutputCard({
  output,
  conversationId,
  placement = 'message',
  jobIds,
  onOpen,
}: {
  output: ConversationOutput;
  conversationId: Id;
  placement?: 'message' | 'popover';
  jobIds?: readonly Id[];
  onOpen?: () => void;
}) {
  const transcribed = useTranscribedInEditor(output);
  // Only take the two characters of the status word; progress ticks do not redraw the whole card (the row subscribes on its own).
  const statusKey = useJobs((s) => {
    if (output.kind !== 'video') return '';
    const status = videoStatus(output.id, s.jobs, transcribed);
    return status ? `${status.key}\n${status.text}` : '';
  });
  const status = statusKey
    ? { key: statusKey.split('\n')[0] as NonNullable<ReturnType<typeof videoStatus>>['key'], text: statusKey.split('\n')[1]! }
    : null;
  const missing = useSpace((s) => outputSourceMissing(output, s));
  const poster = usePoster(output);
  const Icon = KIND_ICON[output.kind];
  const playable = !output.video && output.entry !== null && isPlayable(output.entry.fileName);
  const isVideo = output.kind === 'video';
  const slides = output.slides;
  const design = output.design;
  const designSystem = output.designSystem;
  const words = (
    isVideo
      ? [KIND_LABEL.video, output.durationSeconds ? formatClock(output.durationSeconds) : null]
      : slides
        ? [KIND_LABEL.slides, slides.slideCount === null ? null : SLIDES.pages(slides.slideCount)]
        : design
          ? [KIND_LABEL.design, design.boardCount === null ? null : DESIGN.boards(design.boardCount)]
          : designSystem
            ? [KIND_LABEL['design-system']]
            : [KIND_LABEL[output.kind], output.entry ? formatBytes(output.entry.size) : null, playable ? OUTPUT_COPY.playHere : output.entry ? OUTPUT_COPY.previewHere : null]
  )
    .filter(Boolean)
    .join(' · ');

  // Playing in place in the card: expanding and collapsing is only this card's concern; the media handle is fetched only when play is clicked, and playback starts automatically once the player is attached.
  const [inline, setInline] = useState<MediaHandle | null>(null);
  const [loading, setLoading] = useState(false);
  const runtime = useRuntime();
  const play = (entryId: Id) => {
    setLoading(true);
    runtime
      .resolveMedia({ entryId })
      .then(setInline, (error: unknown) => ToastQueue.negative(VIDEO_CARD_COPY.openFailed(error instanceof Error ? error.message : String(error))))
      .finally(() => setLoading(false));
  };

  const activate = () => {
    onOpen?.();
    const shell = useShell.getState();
    // Prototype home-session.jsx `SessionArtifactCard`: non-video artifacts all open in a single-file tab in the feature area; there, video and audio use the player and the rest use the viewer. Anything that can't be previewed is stated plainly, with “在文件夹中显示” (Show in folder) offered.
    //
    if (output.video) shell.openVideo(output.video);
    // Slides are previewed, edited and annotated in the slides tab in the feature area (docs/design/slides §8.1).
    else if (slides) shell.openPane({ kind: 'slides', target: slides.target });
    // Design drafts likewise open in the design tab in the feature area (docs/design/canvas §8.1).
    else if (design) shell.openPane({ kind: 'design', target: design.target });
    // Design systems open in the design-system tab in the feature area (docs/design/canvas §10.6).
    else if (designSystem) shell.openPane({ kind: 'design-system', target: designSystem.target });
    else if (!isVideo && output.entry) shell.openPane({ kind: 'file', target: { conversationId, path: output.entry.relPath } });
  };

  if (isVideo) {
    const showPoster = poster !== null && !missing;
    // Not yet known where to open it (a video newly created by a flow that the Space has not scanned yet): the picture and “打开编辑器” (Open in editor) are greyed out for now.
    const canOpen = output.video !== null;
    // Playing in place in the card (product design §3.2.2): requires a real frame, the video to be in the Space, and the source file to exist; what plays is the video's original footage, not an edited version.
    const canPlay = showPoster && output.entry !== null;
    return (
      // The play button and “暂无缩略图” (No thumbnail) in the picture area are picture content, so they keep their own size (product design §2.1)
      <div className={`${videoCard} ${cardVars}`} data-cc-icons="own">
        {inline ? (
          <div className="cc-vcard-player">
            <CompactPlayer handle={inline} fileName={output.name} kind="video" memoryKey={`card:${output.id}`} autoPlay />
          </div>
        ) : (
          <RACButton
            className={(state) => `${videoPreview(state)} cc-vcard-preview`}
            aria-label={canPlay ? OUTPUT_COPY.playVideo(output.name) : OUTPUT_COPY.openVideo(output.name)}
            isDisabled={canPlay ? loading : !canOpen}
            onPress={canPlay ? () => play(output.entry!.id) : activate}>
            {showPoster ? (
              <>
                <img className={posterImage} src={poster} alt="" decoding="async" />
                {canPlay ? (
                  <span className={`${playMark} cc-vcard-play`} aria-hidden>
                    <Play />
                  </span>
                ) : null}
              </>
            ) : (
              <>
                {missing ? <AlertTriangle /> : <Icon />}
                {missing ? OUTPUT_COPY.sourceMissing : OUTPUT_COPY.noThumbnail}
              </>
            )}
            {output.durationSeconds ? <span className={`${videoDuration} cc-tabular`}>{formatClock(output.durationSeconds)}</span> : null}
          </RACButton>
        )}
        <div className={videoFooter}>
          <span className={outputBody}>
            <span className={videoName}>{output.name}</span>
            <span className={videoMeta}>
              {status ? <VideoStatusBadge status={status} /> : null}
              <span className={outputDetail}>{words}</span>
            </span>
          </span>
          <ActionButton size="S" styles={videoAction} isDisabled={!canOpen} onPress={activate}>
            {OUTPUT_COPY.openEditor}
          </ActionButton>
        </div>
        {jobIds?.length ? <VideoJobRows jobIds={jobIds} /> : null}
      </div>
    );
  }
  return (
    <RACButton
      className={(state) => outputCard({ ...state, isPopover: placement === 'popover' })}
      aria-label={T.output.aria(output.name, words)}
      onPress={activate}>
      <span className={outputIcon} data-cc-icons="primary">
        <Icon />
      </span>
      <span className={outputBody}>
        <span className={outputName} title={output.name}>
          {output.name}
        </span>
        <span className={outputDetail}>{words}</span>
      </span>
      <span className={outputTail}>
        <ChevronRight />
      </span>
    </RACButton>
  );
}
