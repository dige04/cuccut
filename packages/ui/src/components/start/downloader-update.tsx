import { useLayoutEffect, useRef, type ReactNode } from 'react';
import type { ExternalToolUpdatePlan, JobRecord } from '@cuccut/protocol';
import { ActionButton, Content, Heading, InlineAlert, ProgressBar, Text, Tooltip, TooltipTrigger } from '@react-spectrum/s2';
import Copy from '@react-spectrum/s2/icons/Copy';
import Play from '@react-spectrum/s2/icons/Play';
import StopProcessing from '@react-spectrum/s2/icons/StopProcessing';
import { style } from '@react-spectrum/s2/style' with { type: 'macro' };
import { manualUpdateCommands, updateLog, updateSectionCopy, updateSummary } from '../../model/tool-update.ts';
import { isJobLive } from '../../state/jobs-store.ts';
import { copyText } from '../settings/agent-command-block.tsx';
import { ST } from './start-copy.ts';
import { jobErrorText } from '../../model/localized-text.ts';

/**
 * The “更新” (Update) section in the download tool card (product design §2.7; design draft tool-link.jsx `UpdateSection`): based on the detected install method, it shows one line of command,
 * with Run (triangle) and Copy on the right. What you see is the command that will run; pressing Run runs it with no further confirmation; while it runs, the triangle becomes Stop and the output shows below the command.
 * When the install method cannot be determined, common commands for the Runtime's host platform are listed (four for Windows, three for other systems); where admin rights are needed, the command the Runtime wrote is given
 * (with `sudo` on macOS and Linux). These can only be copied. Status and actions are passed in from the card.
 */

/** This update's status in the card (`update` from `useDownloader`). */
export interface DownloaderUpdateRun {
  jobId: string;
  /** Version before the update (recorded when Run was pressed, or taken from the task record). */
  before: string | null;
  /** The output box is expanded. */
  open: boolean;
  /** The task has finished and re-detection is done: only then report the result, so it does not say “already latest” before the version has refreshed. */
  settled: boolean;
  after: string | null;
}

export interface DownloaderUpdateProps {
  plan: ExternalToolUpdatePlan | null;
  /** The platform of the host the Runtime runs on (`platform` in the status): used to list common commands when the install method cannot be determined. */
  platform: string | null;
  run: DownloaderUpdateRun | null;
  job: JobRecord | null;
  /** Submitting (Run was pressed, the Runtime has not replied yet). */
  busy: boolean;
  onRun: (plan: ExternalToolUpdatePlan) => void;
  onStop: (jobId: string) => void;
  onToggle: () => void;
  onClose: () => void;
}

const section = style({
  display: 'flex',
  flexDirection: 'column',
  gap: 8,
  marginTop: 4,
  paddingTop: 12,
  borderTopWidth: 1,
  borderBottomWidth: 0,
  borderStartWidth: 0,
  borderEndWidth: 0,
  borderStyle: 'solid',
  borderColor: 'gray-300',
});
const group = style({ display: 'flex', flexDirection: 'column', gap: 4 });
const label = style({ font: 'ui-xs', color: 'gray-600' });
const hint = style({ margin: 0, font: 'ui-xs', color: 'gray-700' });
const row = style({ display: 'flex', alignItems: 'center', gap: 4, minWidth: 0, paddingStart: 12, paddingEnd: 4, paddingY: 4, borderRadius: 'lg', backgroundColor: 'gray-100' });
const code = style({ flexGrow: 1, minWidth: 0, font: 'code-sm', color: 'gray-900', overflowWrap: 'anywhere', userSelect: 'text' });
const log = style({
  boxSizing: 'border-box',
  margin: 0,
  maxHeight: 240,
  overflow: 'auto',
  padding: 12,
  borderRadius: 'lg',
  backgroundColor: 'gray-100',
  font: 'code-xs',
  color: 'gray-800',
  whiteSpace: 'pre-wrap',
  overflowWrap: 'anywhere',
  userSelect: 'text',
});
const actions = style({ display: 'flex', alignItems: 'center', gap: 8 });

/** Icon-only button: its name is in `aria-label` and the tooltip. */
function IconAction({ name, onPress, isDisabled, isPending, children }: { name: string; onPress: () => void; isDisabled?: boolean; isPending?: boolean; children: ReactNode }) {
  return (
    <TooltipTrigger delay={400}>
      <ActionButton isQuiet size="S" aria-label={name} isDisabled={isDisabled} isPending={isPending} onPress={onPress}>
        {children}
      </ActionButton>
      <Tooltip>{name}</Tooltip>
    </TooltipTrigger>
  );
}

/** One line of command: monospace and selectable; if it can be run on the user's behalf, there is an extra Run button (it becomes Stop while running); Copy is always present. */
function CommandRow({ command, runner }: { command: string; runner?: { running: boolean; canStop: boolean; busy: boolean; onRun: () => void; onStop: () => void } }) {
  return (
    <div className={row}>
      <code className={code}>{command}</code>
      {runner ? (
        runner.running ? (
          <IconAction name={ST.update.stop} isDisabled={!runner.canStop} onPress={runner.onStop}>
            <StopProcessing />
          </IconAction>
        ) : (
          <IconAction name={ST.update.run} isPending={runner.busy} onPress={runner.onRun}>
            <Play />
          </IconAction>
        )
      ) : null}
      <IconAction name={ST.update.copy} onPress={() => void copyText(command, ST.update.command)}>
        <Copy />
      </IconAction>
    </div>
  );
}

/** Output below the command: while running, lines are appended and it follows to the bottom (it does not fight the scrollbar when the user scrolls up); after it ends, a one-line result, and the output can be collapsed. */
function UpdateOutput({ run, job, onToggle, onClose }: { run: DownloaderUpdateRun; job: JobRecord | null; onToggle: () => void; onClose: () => void }) {
  const live = !job || isJobLive(job);
  const running = live || !run.settled;
  const text = updateLog(job?.command, job?.state ?? null, live);
  const ref = useRef<HTMLPreElement>(null);
  const stick = useRef(true);
  useLayoutEffect(() => {
    const el = ref.current;
    if (el && stick.current) el.scrollTop = el.scrollHeight;
  }, [text, run.open]);
  const sum =
    running || !job
      ? null
      : updateSummary({ state: job.state, exitCode: job.command?.exitCode ?? null, error: jobErrorText(job.error) ?? null, before: run.before, after: run.after });
  return (
    <>
      {running ? (
        <ProgressBar aria-label={ST.update.updating} size="S" isIndeterminate />
      ) : sum ? (
        <InlineAlert variant={sum.tone === 'neutral' ? 'informative' : sum.tone}>
          <Heading>{sum.title}</Heading>
          {sum.body ? <Content>{sum.body}</Content> : null}
        </InlineAlert>
      ) : null}
      {running || run.open ? (
        <pre
          ref={ref}
          className={log}
          role="log"
          aria-label={ST.update.output}
          tabIndex={0}
          onScroll={(e) => {
            const el = e.currentTarget;
            stick.current = el.scrollHeight - el.scrollTop - el.clientHeight < 8;
          }}>
          {text}
        </pre>
      ) : null}
      {running ? null : (
        <div className={actions}>
          <ActionButton size="S" isQuiet aria-expanded={run.open} onPress={onToggle}>
            <Text>{run.open ? ST.update.hideOutput : ST.update.showOutput}</Text>
          </ActionButton>
          <ActionButton size="S" isQuiet onPress={onClose}>
            <Text>{ST.update.close}</Text>
          </ActionButton>
        </div>
      )}
    </>
  );
}

export function DownloaderUpdateSection({ plan, platform, run, job, busy, onRun, onStop, onToggle, onClose }: DownloaderUpdateProps) {
  const copy = updateSectionCopy(plan);
  const live = !!run && (!job || isJobLive(job));
  const running = !!run && (live || !run.settled);
  return (
    <div className={section} role="group" aria-label={ST.update.section}>
      <span className={label}>{copy.label}</span>
      {plan ? (
        <CommandRow
          command={plan.command}
          runner={plan.runnable ? { running, canStop: live && !!job, busy, onRun: () => onRun(plan), onStop: () => run && onStop(run.jobId) } : undefined}
        />
      ) : (
        manualUpdateCommands(platform).map((m) => (
          <div key={m.label} className={group}>
            <span className={label}>{m.label}</span>
            <CommandRow command={m.command} />
          </div>
        ))
      )}
      {copy.hint ? <p className={hint}>{copy.hint}</p> : null}
      {run ? <UpdateOutput run={run} job={job} onToggle={onToggle} onClose={onClose} /> : null}
    </div>
  );
}
