import { useEffect, useState, type ReactElement, type ReactNode } from "react";
import {
  localizeText,
  type HistoryEntry,
  type VideoRef,
  type Sequence,
} from "@cuccut/protocol";
import { EditLabel } from "@cuccut/protocol/messages/ui";
import {
  ActionButton,
  ActionMenu,
  Button,
  DialogTrigger,
  Menu,
  MenuItem,
  MenuSection,
  MenuTrigger,
  Popover,
  ProgressCircle,
  StatusLight,
  Text,
  ToastQueue,
  Tooltip,
  TooltipTrigger,
} from "@react-spectrum/s2";
import Asset from "@react-spectrum/s2/icons/Asset";
import Brush from "@react-spectrum/s2/icons/Brush";
import Close from "@react-spectrum/s2/icons/Close";
import History from "@react-spectrum/s2/icons/History";
import InfoCircle from "@react-spectrum/s2/icons/InfoCircle";
import Keyboard from "@react-spectrum/s2/icons/Keyboard";
import OpenIn from "@react-spectrum/s2/icons/OpenIn";
import Redo from "@react-spectrum/s2/icons/Redo";
import Rename from "@react-spectrum/s2/icons/Rename";
import Settings from "@react-spectrum/s2/icons/Settings";
import Undo from "@react-spectrum/s2/icons/Undo";
import { style } from "@react-spectrum/s2/style" with { type: "macro" };
import { ArrowLeft } from "lucide-react";
import AIMark from "@react-spectrum/s2/icons/AIMark";
import Checkmark from "@react-spectrum/s2/icons/Checkmark";
import {
  IntoSessionSlot,
  useSessionSlotFilled,
} from "../../cc/components/session-slots.tsx";
import { Glass } from "../../cc/ui/glass.tsx";
import { durationSeconds, formatFps } from "../../model/editor.ts";
import { agoLabel, formatClock } from "../../model/format.ts";
import { useRuntime } from "../../runtime/context.tsx";
import { useEditor } from "../../state/editor-store.ts";
import { canEdit, useVideo, type OpenVideo } from "../../state/video-store.ts";
import { useShell } from "../../state/shell-store.ts";
import { ExportButton } from "../export/export-button.tsx";
import { NameDialog } from "../name-dialog.tsx";
import { TaskPill } from "../task-pill.tsx";
import { useNow } from "../use-now.ts";
import { useEditorActions } from "./editor-context.tsx";
import { openVideoSettings } from "./video-settings.tsx";
import { openReview } from "../review/review-dialog.tsx";
import { ShieldCheckIcon } from "../review/review-icon.tsx";
import { REVIEW_COPY } from "../review/review-copy.ts";
import { StyleChoiceDialog } from "./style-choice-dialog.tsx";
import { EditorVideoInfo } from "./video-info.tsx";
import { EDITOR_COPY as E } from "./editor-copy.ts";
import { EDITOR_LAYOUT_COPY as L } from "./editor-layout-copy.ts";
import { VIDEO_BAR_COPY as VB } from "./video-bar-copy.ts";

const MAC = typeof navigator !== "undefined" && /Mac/.test(navigator.platform);
const MOD = MAC ? "⌘" : "Ctrl+";

const historyPanel = style({
  display: "flex",
  flexDirection: "column",
  gap: 4,
  width: 360,
  maxHeight: 420,
});
const historyTitle = style({ font: "title-sm", margin: 0, paddingBottom: 4 });
const historyList = style({
  display: "flex",
  flexDirection: "column",
  overflowY: "auto",
  margin: 0,
  padding: 0,
  listStyleType: "none",
});
const entry = style({
  display: "flex",
  alignItems: "center",
  gap: 8,
  paddingY: 8,
  borderBottomWidth: { default: 1, ":last-child": 0 },
  borderTopWidth: 0,
  borderStartWidth: 0,
  borderEndWidth: 0,
  borderStyle: "solid",
  borderColor: "gray-100",
});
const entryText = style({
  display: "flex",
  flexDirection: "column",
  gap: 2,
  flexGrow: 1,
  minWidth: 0,
});
const entryLabel = style({
  font: "ui-sm",
  color: { default: "gray-900", isUndone: "gray-500" },
});
const entryMeta = style({ font: "ui-xs", color: "gray-600" });

/**
 * The editor's header (agentcut's editor bar; product design §5.1): the video's name and facts, then undo, redo, the saved
 * state (which opens the history, where any single change can be undone), Export as the one tinted action and the overflow
 * menu. In a session these go into the session's glass header (`header-title`, `header-actions`); anywhere else (Space)
 * the pane draws a compact glass bar of its own. Everything about the video as a whole sits behind the **Video** menu.
 */
export function VideoBar({
  video,
  sequence,
  active,
}: {
  video: OpenVideo;
  sequence: Sequence | null;
  active: boolean;
}) {
  const { apply } = useEditorActions();
  const closeVideo = useShell((s) => s.closeVideo);
  const closeLabel = useShell((s) =>
    s.route.tab === "space" ? VB.closeToSpace : VB.closeToHome,
  );
  const slotted = useSessionSlotFilled("header-actions");
  const [renaming, setRenaming] = useState(false);
  const [showInfo, setShowInfo] = useState(false);
  const [choosingStyle, setChoosingStyle] = useState(false);
  const name = video.state?.video.name ?? video.ref?.name ?? VB.untitled;
  const editable = canEdit(video);

  const parts: string[] = [];
  if (sequence) {
    parts.push(formatClock(durationSeconds(sequence), { tenths: true }));
    parts.push(`${sequence.canvas.width}×${sequence.canvas.height}`);
    parts.push(formatFps(sequence.fps));
  }
  // The folder only when it says something the name does not (a video's own folder is usually named after it).
  if (
    video.ref &&
    video.ref.relPath !== name &&
    video.ref.relPath.split("/").pop() !== name
  )
    parts.push(video.ref.relPath);
  const meta = parts.join(" · ");

  const title = (
    <VideoTitle
      name={name}
      meta={meta}
      editable={editable}
      onRename={() => setRenaming(true)}
    />
  );
  const actions = (
    <HeaderActions
      video={video}
      sequence={sequence}
      editable={editable}
      onRename={() => setRenaming(true)}
      onInfo={() => setShowInfo(true)}
      onStyle={() => setChoosingStyle(true)}
      closeLabel={closeLabel}
    />
  );

  return (
    <>
      {!active ? null : slotted ? (
        <>
          <IntoSessionSlot name="header-title" fallback={null}>
            {title}
          </IntoSessionSlot>
          <IntoSessionSlot name="header-actions">{actions}</IntoSessionSlot>
        </>
      ) : (
        <div className="shrink-0 px-3 pt-3">
          <Glass
            shape="capsule"
            className="cc-drag flex min-h-14 items-center gap-2 py-1.5 ps-1.5 pe-2"
          >
            <span data-cc className="contents">
              <button
                type="button"
                aria-label={closeLabel}
                title={closeLabel}
                onClick={closeVideo}
                className="inline-flex size-9 shrink-0 items-center justify-center rounded-full transition-colors hover:bg-white/10 focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
              >
                <ArrowLeft className="size-4" />
              </button>
            </span>
            <div className="min-w-0 flex-1">{title}</div>
            {actions}
          </Glass>
        </div>
      )}
      {renaming ? (
        <NameDialog
          title={VB.rename}
          label={VB.nameLabel}
          initial={name}
          submitLabel={VB.save}
          onClose={() => setRenaming(false)}
          onSubmit={async (next) => {
            const receipt = await apply(
              [{ type: "renameVideo", name: next }],
              EditLabel.renameVideo(),
            );
            if (receipt) setRenaming(false);
          }}
        />
      ) : null}
      {choosingStyle && video.ref ? (
        <StyleChoiceDialog
          source={video.ref.source}
          onClose={() => setChoosingStyle(false)}
        />
      ) : null}
      {showInfo ? (
        <EditorVideoInfo
          video={video}
          sequence={sequence}
          onClose={() => setShowInfo(false)}
        />
      ) : null}
    </>
  );
}

/** The video's name (click to rename) over its facts, agentcut's two-line header title. */
function VideoTitle({
  name,
  meta,
  editable,
  onRename,
}: {
  name: string;
  meta: string;
  editable: boolean;
  onRename(): void;
}) {
  return (
    <div data-cc className="flex min-w-0 flex-col">
      <button
        type="button"
        disabled={!editable}
        onClick={onRename}
        title={VB.rename}
        className="min-w-0 self-start truncate rounded-md text-left text-sm font-medium text-foreground focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none disabled:cursor-default"
      >
        {name}
      </button>
      <p className="truncate text-xs text-muted-foreground tabular-nums">
        {meta}
      </p>
    </div>
  );
}

function HeaderActions({
  video,
  sequence,
  editable,
  onRename,
  onInfo,
  onStyle,
  closeLabel,
}: {
  video: OpenVideo;
  sequence: Sequence | null;
  editable: boolean;
  onRename(): void;
  onInfo(): void;
  onStyle(): void;
  closeLabel: string;
}) {
  const runtime = useRuntime();
  const { undo } = useEditorActions();
  const closeVideo = useShell((s) => s.closeVideo);
  const undoStep = video.undo.undo;
  const redoStep = video.undo.redo;

  const onVideoMenu = (key: string) => {
    if (key === "settings") openVideoSettings();
    else if (key === "rename") onRename();
    else if (key === "details") onInfo();
    else if (key === "review" && video.videoId) openReview(video.videoId);
    else if (key === "style") onStyle();
    else if (key === "shortcuts") useEditor.getState().setShortcutsOpen(true);
  };
  const onMore = (key: string, ref: VideoRef | null) => {
    if (key === "close") return closeVideo();
    if (!ref) return;
    if (key === "reveal") void runtime.host.revealPath(ref.path);
    else if (key === "space") {
      const shell = useShell.getState();
      shell.closeVideo();
      shell.go({
        tab: "space",
        category: "video",
        projectId: ref.source.projectId,
      });
    }
  };

  return (
    <div data-editor-scope className="flex shrink-0 items-center gap-1.5">
      <TaskPill videoId={video.videoId} />
      <MenuTrigger align="end">
        <ActionButton isQuiet>
          <Settings />
          <Text>{L.videoMenu}</Text>
        </ActionButton>
        {/* Settings and the review need the video's sequence and renaming an editable video; the style guide needs to know where the video lives; shortcuts and details are always there. */}
        <Menu
          aria-label={L.videoMenu}
          onAction={(key) => onVideoMenu(String(key))}
          disabledKeys={[
            ...(sequence ? [] : ["settings", "review"]),
            ...(editable ? [] : ["rename"]),
            ...(video.ref ? [] : ["style"]),
          ]}
        >
          <MenuSection>
            <MenuItem id="settings" textValue={L.videoSettings}>
              <Settings />
              <Text slot="label">{L.videoSettings}</Text>
            </MenuItem>
            <MenuItem id="rename" textValue={VB.rename}>
              <Rename />
              <Text slot="label">{VB.rename}</Text>
            </MenuItem>
            <MenuItem id="details" textValue={VB.details}>
              <InfoCircle />
              <Text slot="label">{VB.details}</Text>
            </MenuItem>
            <MenuItem id="review" textValue={REVIEW_COPY.menuItem}>
              <ShieldCheckIcon />
              <Text slot="label">{REVIEW_COPY.menuItem}</Text>
            </MenuItem>
            <MenuItem id="style" textValue={L.styleGuide}>
              <Brush />
              <Text slot="label">{L.styleGuide}</Text>
            </MenuItem>
          </MenuSection>
          <MenuSection>
            <MenuItem id="shortcuts" textValue={L.shortcuts}>
              <Keyboard />
              <Text slot="label">{L.shortcuts}</Text>
            </MenuItem>
          </MenuSection>
        </Menu>
      </MenuTrigger>
      <Tip
        label={
          undoStep
            ? E.undoTip(
                localizeText(undoStep.label, undoStep.labelRef),
                `${MOD}Z`,
              )
            : E.nothingToUndo
        }
      >
        <ActionButton
          isQuiet
          aria-label={E.undo}
          isDisabled={!editable || !undoStep}
          onPress={() => void undo("undo")}
        >
          <Undo />
        </ActionButton>
      </Tip>
      <Tip
        label={
          redoStep
            ? E.redoTip(
                localizeText(redoStep.label, redoStep.labelRef),
                `⇧${MOD}Z`,
              )
            : E.nothingToRedo
        }
      >
        <ActionButton
          isQuiet
          aria-label={E.redo}
          isDisabled={!editable || !redoStep}
          onPress={() => void undo("redo")}
        >
          <Redo />
        </ActionButton>
      </Tip>
      <SaveState video={video} />
      <ExportButton video={video} sequence={sequence} />
      <ActionMenu
        aria-label={L.more}
        isQuiet
        align="end"
        onAction={(key) => onMore(String(key), video.ref)}
        disabledKeys={video.ref ? [] : ["space", "reveal"]}
      >
        <MenuItem id="space" textValue={VB.showInSpace}>
          <Asset />
          <Text slot="label">{VB.showInSpace}</Text>
        </MenuItem>
        <MenuItem id="reveal" textValue={VB.revealVideoFolder}>
          <OpenIn />
          <Text slot="label">{VB.revealVideoFolder}</Text>
        </MenuItem>
        <MenuItem id="close" textValue={closeLabel}>
          <Close />
          <Text slot="label">{closeLabel}</Text>
        </MenuItem>
      </ActionMenu>
    </div>
  );
}

/**
 * The saved state as agentcut's outline capsule: caught up, saving, not caught up, can't open (product design §2.6:
 * connected is not caught up). Pressing it opens the history, so the version and every past change are one click away.
 */
function SaveState({ video }: { video: OpenVideo }) {
  const revision = video.state?.video.revision ?? null;
  if (video.status === "error" || video.status === "stale") {
    // The status takes the capsule's place, but the history stays one click away whenever there is a version to show.
    const light =
      video.status === "error" ? (
        <StatusLight variant="negative">{VB.openFailed}</StatusLight>
      ) : (
        <StatusLight variant="notice">{VB.stale}</StatusLight>
      );
    if (revision === null) return light;
    return (
      <span className="inline-flex shrink-0 items-center gap-1">
        {light}
        <DialogTrigger>
          <Tip label={VB.versionHistory(revision)}>
            <ActionButton isQuiet aria-label={VB.versionHistory(revision)}>
              <History />
            </ActionButton>
          </Tip>
          <Popover placement="bottom end" padding="default">
            <HistoryPanel revision={revision} />
          </Popover>
        </DialogTrigger>
      </span>
    );
  }
  let icon: ReactNode = <Checkmark />;
  let text = VB.saved;
  let tip: string | null = null;
  let pending = false;
  if (video.status === "opening") {
    pending = true;
    text = VB.opening;
  } else if (video.inFlight > 0) {
    pending = true;
    text = VB.saving;
  } else if (video.lastChange?.by === "agent") {
    // The agent just changed it: say what, so the timeline doesn't change for no visible reason (§1.5).
    const label = localizeText(
      video.lastChange.label,
      video.lastChange.labelRef,
    );
    icon = <AIMark />;
    text = VB.savedByAgent(label);
    tip = VB.agentChanged(label);
  }
  const face = (
    <>
      {pending ? null : icon}
      <Text
        UNSAFE_style={{
          maxWidth: 220,
          overflow: "hidden",
          textOverflow: "ellipsis",
          whiteSpace: "nowrap",
        }}
      >
        {text}
      </Text>
    </>
  );
  if (revision === null) {
    return (
      <span
        className="inline-flex h-8 items-center gap-2 px-2 text-sm text-muted-foreground"
        role="status"
      >
        {video.status === "opening" ? (
          <ProgressCircle
            size="S"
            isIndeterminate
            aria-label={VB.openingAria}
          />
        ) : null}
        {text}
      </span>
    );
  }
  return (
    <DialogTrigger>
      <Tip
        label={
          tip ? `${tip} · ${VB.version(revision)}` : VB.versionHistory(revision)
        }
      >
        <ActionButton
          aria-label={`${text} · ${VB.versionHistory(revision)}`}
          isPending={pending}
        >
          {face}
        </ActionButton>
      </Tip>
      <Popover placement="bottom end" padding="default">
        <HistoryPanel revision={revision} />
      </Popover>
    </DialogTrigger>
  );
}

/** History: every change is here and any one of them can be undone; the engine refuses (and says why) on a conflict (§5.5). */
function HistoryPanel({ revision }: { revision: string }) {
  const runtime = useRuntime();
  const { undo } = useEditorActions();
  const editable = useVideo((s) => canEdit(s.video));
  const [entries, setEntries] = useState<HistoryEntry[] | null>(null);
  const now = useNow(30_000);

  useEffect(() => {
    let cancelled = false;
    // Newest first, as the engine returns them.
    runtime.videos.history(100).then(
      (list) => !cancelled && setEntries(list),
      (error: Error) =>
        !cancelled &&
        ToastQueue.negative(VB.historyFailed(error.message), { timeout: 5000 }),
    );
    return () => {
      cancelled = true;
    };
  }, [runtime, revision]);

  return (
    <div className={historyPanel}>
      <h2 className={historyTitle}>
        {VB.history} · {VB.version(revision)}
      </h2>
      {entries === null ? (
        <ProgressCircle
          size="S"
          isIndeterminate
          aria-label={VB.historyLoading}
        />
      ) : entries.length === 0 ? (
        <span className={entryMeta}>{VB.noChanges}</span>
      ) : (
        <ul className={`${historyList} cc-scroll`}>
          {entries.map((item) => {
            const undone = Boolean(item.undoneBy);
            return (
              <li key={item.transactionId} className={entry}>
                <span className={entryText}>
                  <span className={entryLabel({ isUndone: undone })}>
                    {localizeText(item.label, item.labelRef)}
                    {undone ? VB.undoneMark : ""}
                  </span>
                  <span className={entryMeta}>
                    {VB.historyMeta(
                      item.videoRevision,
                      actorLabel(item),
                      agoLabel(item.committedAt, now),
                    )}
                  </span>
                </span>
                {item.undoAvailable && !undone ? (
                  <Button
                    variant="secondary"
                    size="S"
                    isDisabled={!editable}
                    onPress={() =>
                      void undo({ transaction: item.transactionId })
                    }
                  >
                    {VB.undo}
                  </Button>
                ) : null}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

function actorLabel(entry: HistoryEntry): string {
  if (entry.actor.kind === "agent") return VB.actorAgent;
  if (entry.actor.kind === "system") return VB.actorSystem;
  return VB.actorYou;
}

function Tip({ label, children }: { label: string; children: ReactElement }) {
  return (
    <TooltipTrigger>
      {children}
      <Tooltip>{label}</Tooltip>
    </TooltipTrigger>
  );
}
