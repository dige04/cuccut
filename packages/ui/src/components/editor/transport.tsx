import { useMemo, useRef, type ReactElement } from "react";
import type { AssetRecord, Id, Sequence } from "@cuccut/protocol";
import { EditLabel } from "@cuccut/protocol/messages/ui";
import {
  ActionButton,
  DialogTrigger,
  Keyboard,
  Menu,
  MenuItem,
  MenuTrigger,
  Popover,
  Text,
  Tooltip,
  TooltipTrigger,
} from "@react-spectrum/s2";
import ChevronDoubleLeft from "@react-spectrum/s2/icons/ChevronDoubleLeft";
import ChevronDoubleRight from "@react-spectrum/s2/icons/ChevronDoubleRight";
import Cut from "@react-spectrum/s2/icons/Cut";
import Delete from "@react-spectrum/s2/icons/Delete";
import FullScreen from "@react-spectrum/s2/icons/FullScreen";
import More from "@react-spectrum/s2/icons/More";
import ZoomIn from "@react-spectrum/s2/icons/ZoomIn";
import ZoomOut from "@react-spectrum/s2/icons/ZoomOut";
import { Pause, Play, RotateCcw } from "lucide-react";
import {
  nextChapterStart,
  prevChapterStart,
  sequenceChapters,
  visibleChapters,
} from "../../model/chapters.ts";
import {
  durationSeconds,
  frameAt,
  playButtonState,
  type PlayButtonState,
} from "../../model/editor.ts";
import { deletableItemIds, splitOperations } from "../../model/editor-ops.ts";
import { formatClock } from "../../model/format.ts";
import { keyLabel } from "../../model/key-labels.ts";
import {
  ZOOM_MENU,
  zoomLabel as formatZoom,
  type ZoomAction,
} from "../../model/timeline-zoom.ts";
import { TIMELINE_ZOOM_COPY as ZOOM_COPY } from "../../copy.ts";
import { useEditor } from "../../state/editor-store.ts";
import { canEdit, useVideo } from "../../state/video-store.ts";
import { useNarrow } from "../use-narrow.ts";
import { CHAPTER_COPY } from "./chapter-copy.ts";
import { useEditorActions } from "./editor-context.tsx";
import { FULLSCREEN_PLAYER_COPY as F } from "./fullscreen-player-copy.ts";
import { enterPreviewFullscreen } from "./fullscreen-player.tsx";
import {
  CaptionsToggle,
  RatePicker,
  RatioPicker,
  VolumeControl,
} from "./stage-bar.tsx";
import { deleteSelection } from "./timeline-commands.ts";
import { EDITOR_COPY as E } from "./editor-copy.ts";
import { EDITOR_LAYOUT_COPY as L } from "./editor-layout-copy.ts";

/** Narrower than this: no total length; the zoom percentage menu moves into "More controls". */
const COMPACT_WIDTH = 680;
/** Narrower again: no "Timeline" label; chapter steps and ratio (with custom ratio and safe area) move into "More controls". */
const NARROW_WIDTH = 570;
/** Narrowest: captions on/off and monitor volume move into "More controls" too. */
const TIGHT_WIDTH = 390;
/** Narrower still: the clock goes too rather than show half a digit (the ruler and the playhead still say where it is). */
const MINI_WIDTH = 330;

const MAC = typeof navigator !== "undefined" && /Mac/.test(navigator.platform);
const PLAY_ICON = {
  play: Play,
  pause: Pause,
  replay: RotateCcw,
} satisfies Record<PlayButtonState, unknown>;
const ZOOM_KEYS = Object.fromEntries(
  ZOOM_MENU.map(({ id, keys }) => [id, keyLabel(keys, MAC)]),
) as Record<ZoomAction, string>;

/**
 * The head of the timeline card (agentcut's sequence timeline header): play, chapter steps and rate on the left, the
 * "Timeline" label with the clock, then split and delete, the viewing controls that used to sit under the stage (ratio,
 * captions, monitor volume, full screen) and zoom. Undo and redo moved to the editor header.
 *
 * Nothing here re-renders on playhead ticks except the few leaves that show the playhead: the clock, the play button
 * (replay at the end) and split (needs the playhead inside a clip) subscribe to just what they show.
 * `onZoom` is the timeline's zoom (timeline.tsx's handle.zoom): buttons, the percentage menu and the shortcuts share it.
 */
export function Transport({
  sequence,
  assets,
  onZoom,
}: {
  sequence: Sequence;
  assets: Record<Id, AssetRecord>;
  onZoom(action: ZoomAction): void;
}) {
  const actions = useEditorActions();
  const { seek, apply } = actions;
  const editable = useVideo((s) => canEdit(s.video));
  const zoom = useEditor((s) => s.pxPerSecond);
  const deletable = useEditor(
    (s) => deletableItemIds(sequence, s.selection).length > 0,
  );
  const canSplit = useEditor(
    (s) =>
      splitOperations(sequence, s.selection, frameAt(s.playhead, sequence.fps))
        .length > 0,
  );
  const ref = useRef<HTMLDivElement>(null);
  const compact = useNarrow(ref, COMPACT_WIDTH);
  const narrow = useNarrow(ref, NARROW_WIDTH);
  const tight = useNarrow(ref, TIGHT_WIDTH);
  const mini = useNarrow(ref, MINI_WIDTH);
  const totalSeconds = durationSeconds(sequence);
  const chapters = useMemo(() => sequenceChapters(sequence), [sequence]);
  const noChapters = visibleChapters(chapters).length === 0;

  const split = () => {
    const { selection, playhead } = useEditor.getState();
    const operations = splitOperations(
      sequence,
      selection,
      frameAt(playhead, sequence.fps),
    );
    if (operations.length) void apply(operations, EditLabel.splitClip());
  };

  const chapterSteps = (
    <>
      <Tip label={CHAPTER_COPY.prev}>
        <ActionButton
          isQuiet
          size="S"
          aria-label={CHAPTER_COPY.prev}
          isDisabled={noChapters}
          onPress={() =>
            seek(prevChapterStart(chapters, useEditor.getState().playhead))
          }
        >
          <ChevronDoubleLeft />
        </ActionButton>
      </Tip>
      <Tip label={CHAPTER_COPY.next}>
        <ActionButton
          isQuiet
          size="S"
          aria-label={CHAPTER_COPY.next}
          isDisabled={noChapters}
          onPress={() =>
            seek(nextChapterStart(chapters, useEditor.getState().playhead))
          }
        >
          <ChevronDoubleRight />
        </ActionButton>
      </Tip>
    </>
  );
  const ratio = <RatioPicker sequence={sequence} assets={assets} />;
  const viewing = (
    <>
      <CaptionsToggle />
      <VolumeControl />
    </>
  );
  const zoomMenu = (
    <MenuTrigger align="end">
      <TooltipTrigger>
        <ActionButton
          isQuiet
          size="S"
          aria-label={`${ZOOM_COPY.menu} ${formatZoom(zoom)}`}
        >
          <span className="min-w-10 text-center text-xs tabular-nums text-muted-foreground">
            {formatZoom(zoom)}
          </span>
        </ActionButton>
        <Tooltip>{ZOOM_COPY.tip}</Tooltip>
      </TooltipTrigger>
      <Menu
        aria-label={ZOOM_COPY.menu}
        onAction={(key) => onZoom(key as ZoomAction)}
      >
        {ZOOM_MENU.map(({ id }) => (
          <MenuItem key={id} id={id} textValue={ZOOM_COPY[id]}>
            <Text slot="label">{ZOOM_COPY[id]}</Text>
            <Keyboard>{ZOOM_KEYS[id]}</Keyboard>
          </MenuItem>
        ))}
      </Menu>
    </MenuTrigger>
  );

  // The two control groups never shrink; only the heading between them gives way (its label truncates, then it clips).
  // What a narrow bar cannot show moves into the "More controls" popover at its end, so nothing becomes unreachable.
  return (
    <div
      ref={ref}
      className="flex h-10 min-w-0 shrink-0 items-center gap-1 overflow-hidden"
    >
      <div className="flex shrink-0 items-center gap-1">
        <PlayButton duration={totalSeconds} />
        {narrow ? null : chapterSteps}
        <RatePicker />
      </div>
      <h2
        data-cc
        className="ms-1 flex min-w-0 flex-1 items-baseline gap-2 overflow-hidden text-sm font-medium whitespace-nowrap"
      >
        {narrow ? null : <span className="min-w-0 truncate">{L.timeline}</span>}
        {mini ? null : (
          <Clock
            total={compact ? null : formatClock(totalSeconds, { tenths: true })}
          />
        )}
      </h2>
      <div className="flex shrink-0 items-center gap-1">
        <Tip label={E.splitTip}>
          <ActionButton
            isQuiet
            size="S"
            aria-label={E.split}
            isDisabled={!editable || !canSplit}
            onPress={split}
          >
            <Cut />
          </ActionButton>
        </Tip>
        {/* The same path as the Delete key, the inspector and the context menu (deleteSelection): timeline items only. */}
        <Tip label={E.deleteTip}>
          <ActionButton
            isQuiet
            size="S"
            aria-label={E.deleteSelected}
            isDisabled={!editable || !deletable}
            onPress={() => void deleteSelection(actions)}
          >
            <Delete />
          </ActionButton>
        </Tip>
        <Divider />
        {narrow ? null : ratio}
        {tight ? null : viewing}
        <Tip label={F.enterTip}>
          <ActionButton
            isQuiet
            size="S"
            aria-label={F.enter}
            onPress={() =>
              enterPreviewFullscreen(
                ref.current
                  ?.closest("[data-editor-root]")
                  ?.querySelector<HTMLElement>("[data-preview-stage]") ?? null,
              )
            }
          >
            <FullScreen />
          </ActionButton>
        </Tip>
        <Divider />
        <Tip label={`${ZOOM_COPY.out} ${ZOOM_KEYS.out}`}>
          <ActionButton
            isQuiet
            size="S"
            aria-label={ZOOM_COPY.out}
            onPress={() => onZoom("out")}
          >
            <ZoomOut />
          </ActionButton>
        </Tip>
        {compact ? null : zoomMenu}
        <Tip label={`${ZOOM_COPY.in} ${ZOOM_KEYS.in}`}>
          <ActionButton
            isQuiet
            size="S"
            aria-label={ZOOM_COPY.in}
            onPress={() => onZoom("in")}
          >
            <ZoomIn />
          </ActionButton>
        </Tip>
        {compact ? (
          <DialogTrigger>
            <Tip label={L.moreControls}>
              <ActionButton isQuiet size="S" aria-label={L.moreControls}>
                <More />
              </ActionButton>
            </Tip>
            <Popover placement="top end" aria-label={L.moreControls}>
              <div
                role="group"
                aria-label={L.moreControls}
                className="flex items-center gap-1"
              >
                {narrow ? chapterSteps : null}
                {narrow ? ratio : null}
                {tight ? viewing : null}
                {zoomMenu}
              </div>
            </Popover>
          </DialogTrigger>
        ) : null}
      </div>
    </div>
  );
}

/** agentcut's round play button: neutral, because Export is the view's one tinted action. Play / pause / replay at the end. */
function PlayButton({ duration }: { duration: number }) {
  const { seek, togglePlay } = useEditorActions();
  const play = useEditor((s) =>
    playButtonState({ playing: s.playing, playhead: s.playhead, duration }),
  );
  const Icon = PLAY_ICON[play];
  return (
    <button
      type="button"
      data-cc
      aria-label={E.playLabel[play]}
      title={E.playTip[play]}
      onClick={() => {
        // Stopped at the end: start again from the top (the engine is stopped, so toggling plays).
        if (play === "replay") seek(0);
        togglePlay();
      }}
      className="inline-flex size-8 shrink-0 items-center justify-center rounded-full border border-white/15 bg-white/5 shadow-(--control-highlight) transition-[background-color,scale] duration-150 hover:bg-white/10 focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none motion-safe:active:scale-[0.96]"
    >
      <Icon
        aria-hidden
        className={
          play === "play"
            ? "ms-0.5 size-3.5 fill-current"
            : play === "pause"
              ? "size-3.5 fill-current"
              : "size-3.5"
        }
      />
    </button>
  );
}

/** agentcut's "0:16 / 3:12.4": only this leaf follows the playhead, and it re-renders once a second. */
function Clock({ total }: { total: string | null }) {
  const now = useEditor((s) => formatClock(s.playhead));
  return (
    <span
      className="shrink-0 text-xs font-normal tabular-nums text-muted-foreground"
      aria-label={E.playhead}
      title={total ? E.totalLength(total) : undefined}
    >
      {now}
      {total ? ` / ${total}` : null}
    </span>
  );
}

function Divider() {
  return <span aria-hidden className="mx-1 h-4 w-px shrink-0 bg-white/10" />;
}

function Tip({ label, children }: { label: string; children: ReactElement }) {
  return (
    <TooltipTrigger>
      {children}
      <Tooltip>{label}</Tooltip>
    </TooltipTrigger>
  );
}
