import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import type { ExternalToolStatus, JobRecord } from '@cuccut/protocol';
import { ActionButton, Button, DropZone, Text, TextField, ToastQueue, Tooltip, TooltipTrigger } from '@react-spectrum/s2';
import ChevronDown from '@react-spectrum/s2/icons/ChevronDown';
import ChevronUp from '@react-spectrum/s2/icons/ChevronUp';
import Close from '@react-spectrum/s2/icons/Close';
import Filmstrip from '@react-spectrum/s2/icons/Filmstrip';
import Move from '@react-spectrum/s2/icons/Move';
import Upload from '@react-spectrum/s2/icons/Upload';
import { style } from '@react-spectrum/s2/style' with { type: 'macro' };
import {
  Button as RacButton,
  DropIndicator,
  GridList,
  GridListItem,
  useDragAndDrop,
  type DropItem,
} from 'react-aria-components';
import {
  addInputs,
  addNotice,
  ffmpegLine,
  moveInput,
  moveInputs,
  parsePathInput,
  removeInput,
  transcodeJobs,
  type FfmpegLine,
} from '../../model/tools-transcode.ts';
import { liveCount } from '../../model/tools-records.ts';
import { useRuntime } from '../../runtime/context.tsx';
import { useJobs } from '../../state/jobs-store.ts';
import { useTools } from '../../state/tools-store.ts';
import { EmptyCard, PageStatus } from '../models/model-parts.tsx';
import { useNow } from '../use-now.ts';
import { detail, Gate, SideFoot, SideHead } from './tool-parts.tsx';
import { RECORD_COPY, TRANSCODE_COPY } from './tools-copy.ts';
import { TranscodeRecord } from './transcode-record.tsx';

/*
 * Components shared by compress video and merge video (the shared layer of design file tool-video.jsx: drop zone, clip rows, ffmpeg card, and the right-column “任务队列” (job queue)).
 * Three ways to pick files: drag them in (on desktop, the path comes from `pathForFile`), “选择视频…” (Choose video…, `cuccut:pick-media`), or paste the full path —
 * the last one also works in the browser preview, where no native dialog is available.
 */

// ---- Records and ffmpeg ----

/** Records of `transcode` (compress and merge together): the parent jobs in the `jobs` topic that this machine's UI submitted, minus those hidden locally. */
export function useTranscodeRecords(): { ready: boolean; list: JobRecord[]; all: JobRecord[]; live: number } {
  const ready = useJobs((s) => s.ready);
  const all = useJobs((s) => s.jobs);
  const hidden = useTools((s) => s.hidden);
  const list = useMemo(() => transcodeJobs(all, hidden), [all, hidden]);
  return { ready, list, all, live: liveCount(list) };
}

export type FfmpegState = { status: 'checking' } | { status: 'done'; line: FfmpegLine } | { status: 'failed'; message: string };

/**
 * ffmpeg on this computer (`externalTools.detect`; it only runs `ffmpeg -version` and makes no network calls). Not detected in the browser (the Runtime does not expose it to web pages).
 * If the detection itself fails, submission is not blocked: the Runtime checks again on submit and refuses with the reason if it is unavailable.
 */
export function useFfmpeg(enabled: boolean): { state: FfmpegState; recheck: () => void } {
  const runtime = useRuntime();
  const [state, setState] = useState<FfmpegState>({ status: 'checking' });
  const recheck = useCallback(() => {
    setState({ status: 'checking' });
    runtime.detectExternalTool('ffmpeg').then(
      (tool: ExternalToolStatus | null) => setState({ status: 'done', line: ffmpegLine(tool) }),
      (e: Error) => setState({ status: 'failed', message: e.message }),
    );
  }, [runtime]);
  useEffect(() => {
    if (enabled) recheck();
  }, [enabled, recheck]);
  return { state, recheck };
}

/** Gate card when ffmpeg is unusable (design file `FfmpegCard`'s “要先装” (has to be installed first)); the Runtime does not install or upgrade it on the user's behalf, so the fix it gives is written as is. */
export function FfmpegGate({ state, recheck }: { state: FfmpegState; recheck: () => void }) {
  if (state.status !== 'done' || state.line.ready) return null;
  return (
    <Gate
      title={state.line.text}
      body={state.line.remedy ?? ''}
      actions={
        <Button variant="secondary" size="S" onPress={recheck}>
          {TRANSCODE_COPY.recheck}
        </Button>
      }
    />
  );
}

// ---- Choosing files ----

const dropZone = style({ width: 'full' });
const dropBody = style({
  display: 'flex',
  flexDirection: { default: 'column', isCompact: 'row' },
  alignItems: 'center',
  justifyContent: 'center',
  flexWrap: 'wrap',
  gap: { default: 12, isCompact: 8 },
  paddingY: { default: 32, isCompact: 12 },
  paddingX: 16,
  textAlign: 'center',
});
const dropIcon = style({ display: 'flex', color: 'gray-700', '--iconPrimary': { type: 'fill', value: 'currentColor' } });
const dropTitle = style({ font: 'title-sm', color: 'gray-900' });
const dropSub = style({ font: 'ui-xs', color: 'gray-600', maxWidth: 360 });
const pathRow = style({ display: 'flex', alignItems: 'end', gap: 8, minWidth: 0 });
const pathField = style({ flexGrow: 1, minWidth: 0 });

/**
 * Drop zone and “选择视频…” (Choose video…), with a paste-path line below. When empty, it is a large drop zone (design file `.vdrop`); once a file is present it collapses to one line, and files can still be dragged in.
 */
export function FilePicker({
  inputs,
  onChange,
  title,
  sub,
  withAudio = false,
}: {
  inputs: readonly string[];
  onChange: (inputs: string[]) => void;
  title: string;
  sub: string;
  /** Extract audio collects audio files separately. */
  withAudio?: boolean;
}) {
  const runtime = useRuntime();
  const [typed, setTyped] = useState('');
  const take = (paths: readonly string[]) => {
    if (!paths.length) return;
    const result = addInputs(inputs, paths, withAudio);
    const notice = addNotice(result);
    if (notice) ToastQueue.neutral(notice, { timeout: 5000 });
    if (result.inputs.length !== inputs.length) onChange(result.inputs);
  };
  const pick = () => {
    void runtime.host.pickMediaFiles().then(take);
  };
  const drop = async (items: readonly DropItem[]) => {
    const paths: string[] = [];
    let lost = 0;
    for (const item of items) {
      if (item.kind !== 'file') continue;
      const file = await item.getFile();
      const path = runtime.host.pathForFile(file);
      if (path) paths.push(path);
      else lost += 1;
    }
    if (lost) ToastQueue.negative(TRANSCODE_COPY.noPath, { timeout: 6000 });
    take(paths);
  };
  const addTyped = () => {
    const path = parsePathInput(typed);
    if (!path) return;
    take([path]);
    setTyped('');
  };
  const compact = inputs.length > 0;
  return (
    <>
      <DropZone styles={dropZone} onDrop={(e) => void drop(e.items)}>
        <div className={dropBody({ isCompact: compact })}>
          <span className={dropIcon} aria-hidden>
            <Upload />
          </span>
          {compact ? (
            <span className={dropSub}>{TRANSCODE_COPY.dropMore}</span>
          ) : (
            <>
              <span className={dropTitle}>{title}</span>
              <span className={dropSub}>{sub}</span>
            </>
          )}
          <Button variant="secondary" size={compact ? 'S' : 'M'} onPress={pick}>
            {compact ? TRANSCODE_COPY.add : TRANSCODE_COPY.pick}
          </Button>
        </div>
      </DropZone>
      <div className={pathRow}>
        <TextField
          styles={pathField}
          size="S"
          label={TRANSCODE_COPY.pathLabel}
          placeholder={TRANSCODE_COPY.pathPlaceholder}
          value={typed}
          onChange={setTyped}
          onKeyDown={(e) => {
            // React Aria stops keyboard event bubbling by default; ⌘↵ must be let through so it reaches the Workbench submit.
            if (e.key !== 'Enter' || e.metaKey || e.ctrlKey) return e.continuePropagation();
            e.preventDefault();
            addTyped();
          }}
        />
        <Button variant="secondary" size="S" isDisabled={!typed.trim()} onPress={addTyped}>
          {TRANSCODE_COPY.pathAdd}
        </Button>
      </div>
    </>
  );
}

const CLIP_TYPE = 'application/x-cuccut-transcode-input';

const list = style({ display: 'flex', flexDirection: 'column', gap: 4, minWidth: 0, outlineStyle: 'none' });
const clip = style({
  display: 'flex',
  alignItems: 'center',
  gap: 8,
  paddingY: 8,
  paddingStart: 12,
  paddingEnd: 8,
  borderRadius: 'default',
  backgroundColor: { default: 'gray-25', isDragging: 'blue-100' },
  borderWidth: 1,
  borderStyle: 'solid',
  borderColor: 'gray-200',
  opacity: { default: 1, isDragging: 0.6 },
  outlineStyle: { default: 'none', isFocusVisible: 'solid' },
  outlineColor: 'focus-ring',
  outlineWidth: 2,
  outlineOffset: -2,
  minWidth: 0,
});
const clipIndex = style({ font: 'code-xs', color: 'gray-600', width: 20, flexShrink: 0, textAlign: 'end' });
const clipIcon = style({ display: 'flex', flexShrink: 0, color: 'gray-700', '--iconPrimary': { type: 'fill', value: 'currentColor' } });
const grip = style({
  display: 'flex',
  flexShrink: 0,
  padding: 4,
  borderRadius: 'sm',
  backgroundColor: 'transparent',
  borderStyle: 'none',
  color: 'gray-600',
  cursor: 'grab',
  '--iconPrimary': { type: 'fill', value: 'currentColor' },
  outlineStyle: { default: 'none', isFocusVisible: 'solid' },
  outlineColor: 'focus-ring',
  outlineWidth: 2,
});
const clipText = style({ display: 'flex', flexDirection: 'column', flexGrow: 1, minWidth: 0 });
const clipName = style({ font: 'ui-sm', fontWeight: 'bold', color: 'gray-900', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' });
const clipPath = style({ font: 'code-xs', color: 'gray-600', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', userSelect: 'text' });
const indicator = style({
  height: 2,
  marginY: '[-3px]',
  borderRadius: 'full',
  backgroundColor: { default: 'transparent', isDropTarget: 'blue-800' },
  outlineStyle: 'none',
});

/** An icon button with a tooltip (design file `IconBtn tip`). */
function IconButton({ label, onPress, isDisabled, children }: { label: string; onPress: () => void; isDisabled?: boolean; children: ReactNode }) {
  return (
    <TooltipTrigger>
      <ActionButton isQuiet size="S" aria-label={label} isDisabled={isDisabled} onPress={onPress}>
        {children}
      </ActionButton>
      <Tooltip>{label}</Tooltip>
    </TooltipTrigger>
  );
}

/**
 * Selected files (design file `ClipRow` / `SourceRow`): when merging, they have an index, a drag handle and move up / down buttons (RAC drag-and-drop, which also works with the keyboard);
 * when compressing, there is only remove. The same file is added only once, so the path (for a Space entry, `space:<entryId>`) is the row's key.
 */
export function InputList({
  inputs,
  ordered,
  onChange,
  nameOf,
}: {
  inputs: readonly string[];
  ordered: boolean;
  onChange: (inputs: string[]) => void;
  nameOf: (input: string) => { name: string; sub: string };
}) {
  const { dragAndDropHooks } = useDragAndDrop({
    getItems: (keys) => [...keys].map((key) => ({ [CLIP_TYPE]: String(key), 'text/plain': String(key) })),
    acceptedDragTypes: [CLIP_TYPE],
    getDropOperation: () => 'move',
    onReorder: (e) => {
      if (e.target.dropPosition === 'on') return;
      onChange(moveInputs(inputs, [...e.keys].map(String), String(e.target.key), e.target.dropPosition));
    },
    renderDropIndicator: (target) => <DropIndicator target={target} className={({ isDropTarget }) => indicator({ isDropTarget })} />,
  });
  const items = inputs.map((path) => ({ id: path, path }));
  return (
    <GridList
      aria-label={TRANSCODE_COPY.listLabel}
      items={items}
      selectionMode="none"
      dragAndDropHooks={ordered ? dragAndDropHooks : undefined}
      className={list}>
      {(item) => {
        const index = inputs.indexOf(item.path);
        const { name, sub } = nameOf(item.path);
        return (
          <GridListItem id={item.id} textValue={name} className={({ isDragging, isFocusVisible }) => clip({ isDragging, isFocusVisible })}>
            {ordered ? (
              <>
                <span className={clipIndex}>{index + 1}</span>
                <RacButton slot="drag" aria-label={TRANSCODE_COPY.dragLabel(name)} className={({ isFocusVisible }) => grip({ isFocusVisible })}>
                  <Move />
                </RacButton>
              </>
            ) : (
              <span className={clipIcon} aria-hidden>
                <Filmstrip />
              </span>
            )}
            <span className={clipText}>
              <span className={clipName} title={name}>
                {name}
              </span>
              <span className={clipPath} title={sub}>
                {sub}
              </span>
            </span>
            {ordered ? (
              <>
                <IconButton label={TRANSCODE_COPY.moveUp} isDisabled={index === 0} onPress={() => onChange(moveInput(inputs, index, -1))}>
                  <ChevronUp />
                </IconButton>
                <IconButton label={TRANSCODE_COPY.moveDown} isDisabled={index === inputs.length - 1} onPress={() => onChange(moveInput(inputs, index, 1))}>
                  <ChevronDown />
                </IconButton>
              </>
            ) : null}
            <IconButton label={TRANSCODE_COPY.remove} onPress={() => onChange(removeInput(inputs, index))}>
              <Close />
            </IconButton>
          </GridListItem>
        );
      }}
    </GridList>
  );
}

// ---- Right column ----

/**
 * Right column “处理记录” (processing records): compress and merge records are listed together (design file `JobList`). Cancelled items keep one “重新排队” (Requeue) entry, as in the design
 * (it runs locally and is not billed); both failed and finished items are listed. “带回左边再来一版” (Bring back to the left to make another version) is handled by the record card itself, which brings back the matching page depending on whether it was a compress or merge.
 */
export function TranscodeSide() {
  const records = useTranscodeRecords();
  const now = useNow(30_000);
  return (
    <>
      <SideHead
        title={TRANSCODE_COPY.side}
        live={records.live ? RECORD_COPY.live(records.live) : null}
        count={RECORD_COPY.count(records.list.length)}
      />
      {!records.ready ? (
        <PageStatus>{TRANSCODE_COPY.loading}</PageStatus>
      ) : records.list.length ? (
        records.list.map((job) => <TranscodeRecord key={job.jobId} job={job} all={records.all} now={now} />)
      ) : (
        <EmptyCard icon={<Filmstrip />} title={TRANSCODE_COPY.empty} body={TRANSCODE_COPY.emptyBody} />
      )}
      <SideFoot>{TRANSCODE_COPY.sideFoot}</SideFoot>
    </>
  );
}
