import { useState, type ReactNode } from 'react';
import type { JobRecord } from '@cuccut/protocol';
import { ActionButton, Button, Content, Heading, InlineAlert, ProgressBar, ToastQueue } from '@react-spectrum/s2';
import AlertTriangle from '@react-spectrum/s2/icons/AlertTriangle';
import CheckmarkCircle from '@react-spectrum/s2/icons/CheckmarkCircle';
import CloseCircle from '@react-spectrum/s2/icons/CloseCircle';
import { iconStyle, style } from '@react-spectrum/s2/style' with { type: 'macro' };
import {
  cancelledLine,
  cancelPending,
  exportDir,
  exportDoneLine,
  exportOutputs,
  exportPhaseLabel,
  exportPlannedFiles,
  exportProgressLine,
  exportSpeedParts,
  exportTitle,
  exportView,
  exportWarnings,
  type ExportOutputFact,
} from '../../model/export-job.ts';
import { explainExportError } from '../../model/export-rejection.ts';
import { exportOtherWarnings } from '../../model/font-library.ts';
import { jobPercent } from '../../model/task-list.ts';
import { useRuntime } from '../../runtime/context.tsx';
import { useExportSpeed } from '../../state/jobs-store.ts';
import { useShell } from '../../state/shell-store.ts';
import { EXPORT_COPY } from './export-copy.ts';
import { ExportFontFallbacks, useExportFontPhase } from './export-fonts.tsx';
import { Actions, Note, ProblemAlert, Sec, TextLink } from './export-parts.tsx';
import { RejectedAlert, RemedyButtons } from './export-remedy.tsx';
import type { ExportEnv, ExportSubmit } from './use-export-submit.ts';

/**
 * The export the panel is watching (the running / done / cancelled states of the mockup's export.jsx): reads the job record in jobs-store. Speed and time remaining are estimated from progress over the last few seconds (`useExportSpeed`), and not written when they cannot be computed.
 * Closing the panel does not stop the export. Cancelling asks for confirmation first, and once files start being saved it cannot be stopped (the Runtime only checks for cancellation before saving).
 */

const head = style({ display: 'flex', alignItems: 'center', gap: 12, minWidth: 0 });
const headText = style({ display: 'flex', flexDirection: 'column', gap: 2, minWidth: 0 });
const headTitle = style({ margin: 0, font: 'title', color: 'gray-900' });
const headSub = style({ font: 'ui-sm', color: 'gray-600', overflowWrap: 'anywhere' });
const bar = style({ marginTop: 16 });
const stats = style({ display: 'flex', flexWrap: 'wrap', columnGap: 12, rowGap: 2, marginTop: 8, font: 'ui-sm', color: 'gray-700' });
const pctText = style({ font: 'code-sm', fontWeight: 'bold', color: 'gray-900' });
const speedText = style({ fontVariantNumeric: 'tabular-nums' });
const confirm = style({ marginTop: 16 });
const confirmActs = style({ display: 'flex', justifyContent: 'end', gap: 8, marginTop: 8 });
const list = style({ display: 'flex', flexDirection: 'column', gap: 4, margin: 0, marginTop: 12, padding: 0, listStyleType: 'none' });
const outRow = style({ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 });
const outText = style({ display: 'flex', flexDirection: 'column', flexGrow: 1, minWidth: 0 });
const outName = style({ font: 'code-sm', color: 'gray-900', overflowWrap: 'anywhere' });
const outMeta = style({ font: 'ui-xs', color: 'gray-600' });
const warnList = style({ margin: 0, paddingStart: 16, font: 'ui-xs', color: 'gray-700', overflowWrap: 'anywhere' });
const okIcon = iconStyle({ size: 'XL', color: 'positive' });
const stopIcon = iconStyle({ size: 'XL', color: 'neutral' });
const failIcon = iconStyle({ size: 'XL', color: 'notice' });

export function ExportJobView({
  job,
  env,
  submitter,
  onReset,
  onClose,
}: {
  job: JobRecord;
  env: ExportEnv;
  submitter: ExportSubmit;
  /** Back to the settings page (set again / export another copy). */
  onReset: () => void;
  onClose: () => void;
}) {
  switch (exportView(job)) {
    case 'run':
      return <ExportRunning job={job} onClose={onClose} />;
    case 'done':
      return <ExportDone job={job} onReset={onReset} onClose={onClose} />;
    case 'cancelled':
      return <ExportCancelled job={job} onReset={onReset} onClose={onClose} />;
    case 'interrupted':
      return <ExportInterrupted job={job} env={env} submitter={submitter} onReset={onReset} />;
    case 'failed':
      return <ExportFailed job={job} env={env} submitter={submitter} onReset={onReset} />;
  }
}

function Head({ icon, title, sub }: { icon?: ReactNode; title: string; sub?: ReactNode }) {
  return (
    <div className={head}>
      {icon}
      <div className={headText}>
        <h3 className={headTitle}>{title}</h3>
        {sub ? <span className={headSub}>{sub}</span> : null}
      </div>
    </div>
  );
}

function plannedLine(job: JobRecord): string {
  const files = exportPlannedFiles(job);
  if (!files.length) return job.export ? exportTitle(job.export.settings) : '';
  return files.length === 1 ? files[0]! : EXPORT_COPY.plannedFiles(files[0]!, files.length);
}

/** Running state: the progress bar and percentage only show the progress the Runtime reports; with no total it is indeterminate. While rendering, it follows fps and the estimated time remaining. */
function ExportRunning({ job, onClose }: { job: JobRecord; onClose: () => void }) {
  const runtime = useRuntime();
  const [asking, setAsking] = useState(false);
  const [cancelling, setCancelling] = useState(false);
  const pending = cancelPending(job) || cancelling;
  const pct = job.state === 'running' ? jobPercent(job) : null;
  // While downloading fonts, the phase already reads the family and percentage, so bytes are not shown here.
  const fontPhase = useExportFontPhase(job);
  const progress = fontPhase ? null : exportProgressLine(job);
  // Speed only exists at render time (`export-speed.ts`); during the font download, the phase already reads the progress, so nothing is written here.
  const speed = exportSpeedParts(useExportSpeed(fontPhase ? null : job.jobId));
  const title = job.state === 'queued' ? EXPORT_COPY.queued : pending ? EXPORT_COPY.cancelling : EXPORT_COPY.running;

  const cancel = async () => {
    setAsking(false);
    setCancelling(true);
    try {
      await runtime.cancelJob(job.jobId);
    } catch (error) {
      setCancelling(false);
      ToastQueue.negative(EXPORT_COPY.cancelFailed((error as Error).message), { timeout: 5000 });
    }
  };

  return (
    <>
      <Head title={title} sub={plannedLine(job)} />
      <div className={bar}>
        <ProgressBar aria-label={title} isIndeterminate={pct == null} value={pct ?? undefined} />
      </div>
      <div className={stats}>
        {pct != null ? <span className={pctText}>{pct}%</span> : null}
        <span>{fontPhase ?? exportPhaseLabel(job)}</span>
        {progress ? <span>{progress}</span> : null}
        {speed.map((part) => (
          <span key={part} className={speedText}>
            {part}
          </span>
        ))}
      </div>
      <Note>
        {EXPORT_COPY.keepsRunning}{' '}
        <TextLink
          onPress={() => {
            onClose();
            useShell.getState().go({ tab: 'tasks', taskId: job.jobId });
          }}>
          {EXPORT_COPY.goTasks}
        </TextLink>
      </Note>
      {asking ? (
        <div className={confirm}>
          <InlineAlert variant="notice">
            <Heading>{EXPORT_COPY.cancelConfirm}</Heading>
            <Content>
              {EXPORT_COPY.cancelConfirmBody}
              <div className={confirmActs}>
                <Button variant="secondary" size="S" onPress={() => setAsking(false)}>
                  {EXPORT_COPY.keepExporting}
                </Button>
                <Button variant="negative" size="S" onPress={() => void cancel()}>
                  {EXPORT_COPY.cancelExport}
                </Button>
              </div>
            </Content>
          </InlineAlert>
        </div>
      ) : (
        <Actions>
          <Button variant="negative" fillStyle="outline" isDisabled={pending} onPress={() => setAsking(true)}>
            {pending ? EXPORT_COPY.cancelling : EXPORT_COPY.cancelExport}
          </Button>
        </Actions>
      )}
    </>
  );
}

/** Published files: the filename uses the actual path, one per line, and can be revealed in the folder. */
function Outputs({ outputs }: { outputs: readonly ExportOutputFact[] }) {
  const runtime = useRuntime();
  if (!outputs.length) return null;
  return (
    <ul className={list}>
      {outputs.map((o) => (
        <li key={o.key} className={outRow}>
          <span className={outText}>
            <span className={outName}>{o.name}</span>
            <span className={outMeta}>{o.meta}</span>
          </span>
          {o.path && outputs.length > 1 ? (
            <ActionButton isQuiet size="S" onPress={() => void runtime.host.revealPath(o.path!)}>
              {EXPORT_COPY.reveal}
            </ActionButton>
          ) : null}
        </li>
      ))}
    </ul>
  );
}

/** Notices recorded during export: skipped content, objects not written into the project, loudness that could not be measured... each listed one by one with the Runtime's own words. */
function Warnings({ job }: { job: JobRecord }) {
  // Font fallbacks are listed separately above (ExportFontFallbacks); the kernel's missing-font notice for the same family is not repeated.
  const warnings = exportWarnings({ warnings: exportOtherWarnings(job.warnings) });
  if (!warnings.length) return null;
  return (
    <>
      <Sec>{EXPORT_COPY.warnings}</Sec>
      <ul className={warnList}>
        {warnings.slice(0, 12).map((w) => (
          <li key={w}>{w}</li>
        ))}
        {warnings.length > 12 ? <li>{EXPORT_COPY.moreWarnings(warnings.length - 12)}</li> : null}
      </ul>
    </>
  );
}

function RevealButton({ job }: { job: JobRecord }) {
  const runtime = useRuntime();
  const target = exportOutputs(job)[0]?.path ?? exportDir(job);
  if (!target) return null;
  return (
    <Button variant="secondary" onPress={() => void runtime.host.revealPath(target)}>
      {EXPORT_COPY.reveal}
    </Button>
  );
}

function ExportDone({ job, onReset, onClose }: { job: JobRecord; onReset: () => void; onClose: () => void }) {
  const outputs = exportOutputs(job);
  return (
    <>
      <Head icon={<CheckmarkCircle styles={okIcon} data-cc-icons="own" />} title={EXPORT_COPY.exported} sub={exportDoneLine(job)} />
      <Outputs outputs={outputs} />
      <ExportFontFallbacks job={job} />
      <Warnings job={job} />
      <Actions>
        <Button variant="secondary" fillStyle="outline" onPress={onReset}>
          {EXPORT_COPY.again}
        </Button>
        <RevealButton job={job} />
        <Button variant="accent" onPress={onClose}>
          {EXPORT_COPY.done}
        </Button>
      </Actions>
    </>
  );
}

function ExportCancelled({ job, onReset, onClose }: { job: JobRecord; onReset: () => void; onClose: () => void }) {
  const outputs = exportOutputs(job);
  return (
    <>
      <Head icon={<CloseCircle styles={stopIcon} data-cc-icons="own" />} title={EXPORT_COPY.cancelled} sub={cancelledLine(job)} />
      <Outputs outputs={outputs} />
      <Actions>
        <Button variant="secondary" fillStyle="outline" onPress={onClose}>
          {EXPORT_COPY.close}
        </Button>
        <Button variant="accent" onPress={onReset}>
          {EXPORT_COPY.resetup}
        </Button>
      </Actions>
    </>
  );
}

/** The Runtime stopped or restarted before this finished: it does not resume. Export again as is, or go back and change the settings. */
function ExportInterrupted({ job, env, submitter, onReset }: { job: JobRecord; env: ExportEnv; submitter: ExportSubmit; onReset: () => void }) {
  const settings = job.export?.settings ?? null;
  return (
    <>
      <Head
        icon={<AlertTriangle styles={failIcon} data-cc-icons="own" />}
        title={EXPORT_COPY.interrupted}
        sub={EXPORT_COPY.interruptedBody}
      />
      <RejectedAlert problem={submitter.problem} settings={submitter.rejected} videoId={env.videoId} busy={submitter.busy} onSubmit={(s, dir) => void submitter.submit(s, dir)} />
      <Actions>
        <Button variant="secondary" fillStyle="outline" onPress={onReset}>
          {EXPORT_COPY.resetup}
        </Button>
        {settings ? (
          <Button variant="accent" isPending={submitter.busy} isDisabled={!env.ready} onPress={() => void submitter.submit(settings)}>
            {EXPORT_COPY.retry}
          </Button>
        ) : null}
      </Actions>
    </>
  );
}

/**
 * Failed: the Runtime's own words and the itemized list (failure codes see export-service.ts TaskFailure). If only part was published, the files already saved are listed.
 * The remedy the UI can do directly (another location) goes in the notices, or export again as is.
 */
function ExportFailed({ job, env, submitter, onReset }: { job: JobRecord; env: ExportEnv; submitter: ExportSubmit; onReset: () => void }) {
  const settings = job.export?.settings ?? null;
  const problem = explainExportError(job.error, { kind: settings?.kind ?? 'video', stage: 'failed', documents: env.documents });
  const outputs = exportOutputs(job);
  return (
    <>
      <ProblemAlert
        problem={problem}
        actions={
          settings && problem.remedy ? (
            <RemedyButtons problem={problem} settings={settings} videoId={env.videoId} busy={submitter.busy} onSubmit={(s, dir) => void submitter.submit(s, dir)} />
          ) : null
        }
      />
      {outputs.length ? (
        <>
          <Sec>{EXPORT_COPY.partial}</Sec>
          <Outputs outputs={outputs} />
        </>
      ) : null}
      <Warnings job={job} />
      <RejectedAlert problem={submitter.problem} settings={submitter.rejected} videoId={env.videoId} busy={submitter.busy} onSubmit={(s, dir) => void submitter.submit(s, dir)} />
      <Actions>
        <Button variant="secondary" fillStyle="outline" onPress={onReset}>
          {EXPORT_COPY.resetup}
        </Button>
        {settings ? (
          <Button variant="accent" isPending={submitter.busy} isDisabled={!env.ready} onPress={() => void submitter.submit(settings)}>
            {EXPORT_COPY.retry}
          </Button>
        ) : null}
      </Actions>
    </>
  );
}
