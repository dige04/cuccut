import { useMemo, useState } from 'react';
import type { Id, SpaceEntry } from '@cuccut/protocol';
import { ActionButton, Button, Text, ToastQueue } from '@react-spectrum/s2';
import FileText from '@react-spectrum/s2/icons/FileText';
import Folder from '@react-spectrum/s2/icons/Folder';
import { style } from '@react-spectrum/s2/style' with { type: 'macro' };
import { mergeDraft } from '../../model/ai-tools-handoff.ts';
import { entryPath, videoTargetOf } from '../../model/space.ts';
import { placeKindOf, videoNameOf } from '../../model/space-actions.ts';
import { isVideoTool, type ToolId } from '../../model/tool-catalog.ts';
import { saveDirLabel } from '../../model/tool-frame.ts';
import { entriesOfJob, followUps, handoverText, newMovieBlock, outputDetail, type FollowUp } from '../../model/tool-outputs.ts';
import { useRuntime } from '../../runtime/context.tsx';
import { useDirectory } from '../../state/directory-store.ts';
import { useShell } from '../../state/shell-store.ts';
import { showInSpace } from '../../state/space-focus-store.ts';
import { useSpace } from '../../state/space-store.ts';
import { EntryThumb } from '../space/space-list.tsx';
import { detail } from './tool-parts.tsx';
import { OUTPUT_COPY } from './tools-copy.ts';
import { ProjectPicker } from './tool-run-view.tsx';
import { useVideoTools } from './use-video-tools.ts';

/*
 * Output row (product design §2.7 “Results and next steps”, design file tool-frame.jsx `ToolOutputRow` / `ToolOutputs`): one row for each entry a run published to the Space —
 * name, kind, size or duration, and folder; View in Space, Show in folder (not on the web, since the browser cannot open local folders),
 * Hand to Agent (`space.continueInConversation` carries the reference and pre-fills a sentence that can be edited, without sending it automatically), and which tool to use next.
 * Shared by the result page, the job details and the generation records. For what to do next, see model/tool-outputs.ts.
 */

/** The outputs these jobs published to the Space (`origin.jobId`). */
export function useJobOutputs(jobIds: readonly Id[]): SpaceEntry[] {
  const entries = useSpace((s) => s.entries);
  const key = jobIds.join('\n');
  // eslint-disable-next-line react-hooks/exhaustive-deps -- compares by the joined ID string, so the result is not recomputed when the caller passes a new array each time
  return useMemo(() => entriesOfJob(entries, jobIds), [entries, key]);
}

/** The actions for one output; apart from `openEntry`, none of them care which page invoked them. */
export function useOutputActions() {
  const runtime = useRuntime();
  const projects = useDirectory((s) => s.projects);
  const conversations = useDirectory((s) => s.conversations);
  const { go, openVideo } = useShell.getState();
  const web = runtime.host.platform === 'web';

  const pathOf = (entry: SpaceEntry) => entry.file?.path ?? entryPath(entry, { projects, conversations });
  const reveal = (entry: SpaceEntry) => {
    const path = pathOf(entry);
    if (!path) return;
    runtime.host.revealPath(path).catch((e: Error) => ToastQueue.negative(OUTPUT_COPY.revealFailed(e.message), { timeout: 6000 }));
  };
  const handover = (entry: SpaceEntry) => {
    runtime
      .continueSpaceEntry(entry.id)
      .then(({ conversation, created }) => {
        const shell = useShell.getState();
        shell.setDraft(conversation.id, mergeDraft(shell.drafts[conversation.id], handoverText(entry)));
        go({ tab: 'home', conversationId: conversation.id, projectId: null });
        ToastQueue.positive(OUTPUT_COPY.handedOver(created, entry.name, conversation.title || OUTPUT_COPY.untitled), { timeout: 6000 });
      })
      .catch((e: Error) => ToastQueue.negative(OUTPUT_COPY.handoverFailed(e.message), { timeout: 6000 }));
  };
  const toTool = (tool: ToolId, entry: SpaceEntry) => {
    const { setPreset, setView } = useVideoTools.getState();
    setPreset({ tool, entryId: entry.id });
    if (isVideoTool(tool)) setView(tool, null);
    go({ tab: 'tools', tool });
  };
  const openMovie = (entry: SpaceEntry) => openVideo(videoTargetOf(entry), { conversationId: null, projectId: entry.source.projectId });
  const newMovie = async (entry: SpaceEntry, projectId: Id) => {
    const path = pathOf(entry);
    if (!path) return;
    const name = videoNameOf(path);
    try {
      const { target, importError } = await runtime.createVideoFromFile({ projectId }, path, placeKindOf(entry.fileName), name);
      openVideo(target, { conversationId: null, projectId });
      if (importError) ToastQueue.negative(OUTPUT_COPY.newMovieEmpty(importError), { timeout: 8000 });
      else ToastQueue.positive(OUTPUT_COPY.newMovieDone(name), { timeout: 4000 });
    } catch (e) {
      ToastQueue.negative(OUTPUT_COPY.newMovieFailed((e as Error).message), { timeout: 6000 });
    }
  };
  return { web, pathOf, reveal, handover, toTool, openMovie, newMovie, view: showInSpace };
}

const row = style({
  display: 'flex',
  flexDirection: 'column',
  gap: 8,
  padding: { default: 12, isCompact: 8, isPanel: 16 },
  borderRadius: { default: '[16px]', isPanel: '[24px]' },
  borderWidth: 1,
  borderStyle: 'solid',
  borderColor: 'gray-200',
  backgroundColor: 'base',
  minWidth: 0,
});
const head = style({ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 });
const text = style({ display: 'flex', flexDirection: 'column', gap: 2, minWidth: 0, flexGrow: 1 });
const name = style({ font: 'ui', fontWeight: 'bold', color: 'gray-900', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' });
const sub = style({ font: 'ui-xs', color: 'gray-700', overflowWrap: 'anywhere' });
const acts = style({ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 4 });
const nextRow = style({ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 8 });
const nextLabel = style({ font: 'ui-xs', color: 'gray-700' });
const pickBox = style({ display: 'flex', flexDirection: 'column', gap: 8, width: 'full' });

/** “Create video from this”: for audio, image and video files, after picking a project they become the assets of a new video directly; for documents and subtitles, the reason it is not possible is stated. */
function NewMovieFrom({ entry, label }: { entry: SpaceEntry; label: string }) {
  const actions = useOutputActions();
  const [open, setOpen] = useState(false);
  const [projectId, setProjectId] = useState<Id | null>(null);
  const [busy, setBusy] = useState(false);
  const block = newMovieBlock(entry, actions.pathOf(entry));
  if (block) {
    return (
      <>
        <Button variant="secondary" size="S" isDisabled>
          {label}
        </Button>
        <span className={detail}>{block}</span>
      </>
    );
  }
  if (!open) {
    return (
      <Button variant="secondary" size="S" onPress={() => setOpen(true)}>
        {label}
      </Button>
    );
  }
  const go = () => {
    if (!projectId) return;
    setBusy(true);
    void actions.newMovie(entry, projectId).finally(() => setBusy(false));
  };
  return (
    <div className={pickBox}>
      <span className={detail}>{OUTPUT_COPY.newMovieNote}</span>
      <ProjectPicker value={projectId} onChange={setProjectId} />
      <div className={acts}>
        <Button variant="secondary" size="S" isDisabled={!projectId} isPending={busy} onPress={go}>
          {OUTPUT_COPY.newMovieGo}
        </Button>
        <ActionButton isQuiet size="S" onPress={() => setOpen(false)}>
          <Text>{OUTPUT_COPY.newMovieCancel}</Text>
        </ActionButton>
      </div>
    </div>
  );
}

/**
 * The output row; `fromTool` is the tool that produced it (a result written into a video gets its next step from it); `compact` is the narrow version in a record card.
 * `primary`: this row's "Open in editor" is the view's one yellow; rows are repeated, so it defaults to neutral.
 */
export function ToolOutputRow({
  entry,
  fromTool,
  compact = false,
  panel = false,
  primary = false,
}: {
  entry: SpaceEntry;
  fromTool?: ToolId | null;
  compact?: boolean;
  panel?: boolean;
  primary?: boolean;
}) {
  const actions = useOutputActions();
  const movie = entry.kind === 'video';
  const nexts = followUps(entry, fromTool);
  const open = nexts.find((n) => n.id === 'open-movie');
  const rest = nexts.filter((n) => n.id !== 'open-movie');
  const path = movie ? null : actions.pathOf(entry);
  const pending = entry.status === 'generating';
  const btn = (n: FollowUp) =>
    n.id === 'new-movie' ? (
      <NewMovieFrom key={n.id} entry={entry} label={n.label} />
    ) : n.kind === 'tool' ? (
      <Button key={n.id} variant="secondary" size="S" isDisabled={pending} onPress={() => actions.toTool(n.id as ToolId, entry)}>
        {n.label}
      </Button>
    ) : null;
  return (
    <div className={row({ isCompact: compact, isPanel: panel })}>
      <div className={head}>
        <EntryThumb entry={entry} small />
        <span className={text}>
          <span className={name} title={entry.name}>
            {entry.name}
          </span>
          <span className={sub}>{movie ? OUTPUT_COPY.movie : outputDetail(entry)}</span>
        </span>
      </div>
      <div className={acts}>
        {open ? (
          <Button variant={primary ? 'accent' : 'secondary'} size="S" onPress={() => actions.openMovie(entry)}>
            {open.label}
          </Button>
        ) : null}
        {!movie ? (
          <ActionButton isQuiet size="S" onPress={() => actions.view(entry)}>
            <FileText />
            <Text>{OUTPUT_COPY.inSpace}</Text>
          </ActionButton>
        ) : null}
        {!movie && !actions.web && path ? (
          <ActionButton isQuiet size="S" onPress={() => actions.reveal(entry)}>
            <Folder />
            <Text>{OUTPUT_COPY.reveal}</Text>
          </ActionButton>
        ) : null}
        <ActionButton isQuiet size="S" isDisabled={pending} onPress={() => actions.handover(entry)}>
          <Text>{OUTPUT_COPY.handover}</Text>
        </ActionButton>
      </div>
      {rest.length ? (
        <div className={nextRow}>
          <span className={nextLabel}>{OUTPUT_COPY.nextLabel}</span>
          {rest.map(btn)}
        </div>
      ) : null}
    </div>
  );
}

const list = style({ display: 'flex', flexDirection: 'column', gap: 8, minWidth: 0 });
const listHead = style({ display: 'flex', alignItems: 'baseline', gap: 8, minWidth: 0 });
const listTitle = style({
  flexGrow: 1,
  margin: 0,
  paddingX: { default: 0, isPanel: 4 },
  font: { default: 'detail', isPanel: 'ui' },
  fontWeight: { default: 'bold', isPanel: 'medium' },
  color: { default: 'gray-700', isPanel: 'gray-900' },
});

/** All outputs of one run; if `saveDir` is given, the save location is written in the header. Nothing is drawn when there are no outputs. */
export function ToolOutputs({
  entries,
  fromTool,
  saveDir,
  panel = false,
  primaryOpen = false,
}: {
  entries: readonly SpaceEntry[];
  fromTool?: ToolId | null;
  saveDir?: string | null;
  /** In a page column of panels (task details): the heading and 24px cards match the other sections. */
  panel?: boolean;
  /** The first video's "Open in editor" is the view's one yellow (a run's result page); otherwise every row stays neutral. */
  primaryOpen?: boolean;
}) {
  if (!entries.length) return null;
  const firstVideo = primaryOpen ? entries.findIndex((e) => e.kind === 'video') : -1;
  return (
    <div className={list}>
      <div className={listHead}>
        <h3 className={listTitle({ isPanel: panel })}>{OUTPUT_COPY.title}</h3>
        {saveDir ? <span className={detail}>{OUTPUT_COPY.savedIn(saveDirLabel(saveDir))}</span> : null}
      </div>
      {entries.map((e, i) => (
        <ToolOutputRow key={e.id} entry={e} fromTool={fromTool} panel={panel} primary={i === firstVideo} />
      ))}
    </div>
  );
}
