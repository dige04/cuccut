import { useEffect, useState, type ReactNode } from 'react';
import { live, type JobRecord, type TaskSummary } from '@cuccut/protocol';
import { ActionButton, Badge, ProgressCircle, Text, ToastQueue } from '@react-spectrum/s2';
import AlertTriangle from '@react-spectrum/s2/icons/AlertTriangle';
import AudioWave from '@react-spectrum/s2/icons/AudioWave';
import Copy from '@react-spectrum/s2/icons/Copy';
import FileText from '@react-spectrum/s2/icons/FileText';
import Filmstrip from '@react-spectrum/s2/icons/Filmstrip';
import Folder from '@react-spectrum/s2/icons/Folder';
import Image from '@react-spectrum/s2/icons/Image';
import { style } from '@react-spectrum/s2/style' with { type: 'macro' };
import { TASK_VIEW_COPY } from '../../copy.ts';
import { formatClock, shortenPath } from '../../model/format.ts';
import { imageRequest, jobOutputs, secs, type FactRow, type OutputRow } from '../../model/task-facts.ts';
import { useRuntime } from '../../runtime/context.tsx';
import { useProject } from '../../state/directory-store.ts';
import { useVideo } from '../../state/video-store.ts';
import { TK } from './tasks-copy.ts';
import { jobErrorText } from '../../model/localized-text.ts';

/** Prototype `.t-section`: 11px bold grey text, with a 28 gap between sections. */
export const sectionTitle = style({ font: 'ui-xs', fontWeight: 'bold', color: 'gray-600', margin: 0, marginTop: 28 });
/** Prototype `.card.card--layer`. */
const layer = style({
  borderRadius: '[24px]',
  borderWidth: 1,
  borderStyle: 'solid',
  borderColor: 'gray-200',
  backgroundColor: 'gray-50',
  overflow: 'hidden',
});
/** A detail section in the page's column (agentcut `Panel` with its small heading above). */
const panel = style({ display: 'flex', flexDirection: 'column', gap: 8, minWidth: 0 });
const panelTitle = style({ font: 'ui', fontWeight: 'medium', color: 'gray-900', margin: 0, paddingX: 4 });
const rows = style({ display: 'flex', flexDirection: 'column', paddingX: 20 });
const row = style({
  display: 'flex',
  alignItems: { default: 'center', top: 'start' },
  gap: 12,
  paddingY: 12,
  borderTopWidth: { default: 1, ':first-child': 0 },
  borderBottomWidth: 0,
  borderStartWidth: 0,
  borderEndWidth: 0,
  borderStyle: 'solid',
  borderColor: 'gray-200',
});
const rowIcon = style({ display: 'flex', flexShrink: 0, color: 'gray-700' });
const rowBody = style({ flexGrow: 1, flexShrink: 1, minWidth: 0 });
const rowHead = style({ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 });
const name = style({ font: 'ui', color: 'gray-900', minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' });
const mono = style({ font: 'code-xs', color: 'gray-600' });
const path = style({ font: 'ui-xs', color: 'gray-600', marginTop: 2, overflowWrap: 'anywhere', userSelect: 'text' });
const meta = style({ font: 'ui-xs', color: 'gray-600', marginTop: 4 });
const prompt = style({
  font: 'body-sm',
  color: 'gray-800',
  marginTop: 4,
  overflowWrap: 'anywhere',
  overflow: 'hidden',
  userSelect: 'text',
});
const errorText = style({ font: 'ui-sm', color: 'red-900', marginTop: 4, overflowWrap: 'anywhere' });
const acts = style({ display: 'flex', flexDirection: 'column', alignItems: 'end', gap: 4, flexShrink: 0 });
const thumb = style({
  position: 'relative',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  flexShrink: 0,
  width: 72,
  height: 72,
  borderRadius: 'default',
  overflow: 'hidden',
  font: 'ui-xs',
  backgroundColor: { default: 'gray-200', isError: 'red-100' },
  color: { default: 'gray-700', isError: 'red-900' },
});
const thumbImage = style({ width: 'full', height: 'full', objectFit: 'cover' });
const thumbMore = style({
  position: 'absolute',
  right: 4,
  bottom: 4,
  paddingX: '[6px]',
  borderRadius: 'default',
  font: 'ui-xs',
  fontWeight: 'bold',
  backgroundColor: 'gray-900',
  color: 'gray-25',
});
const facts = style({ display: 'flex', flexDirection: 'column', paddingX: 20, paddingY: 12 });
const fact = style({ display: 'flex', alignItems: 'baseline', paddingY: 4 });
const factLabel = style({ font: 'ui-sm', fontWeight: 'medium', color: 'gray-700', width: 88, flexShrink: 0 });
const factValue = style({ font: 'ui', color: 'gray-800', minWidth: 0, overflowWrap: 'anywhere', userSelect: 'text' });

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className={panel}>
      <h2 className={panelTitle}>{title}</h2>
      <div className={layer}>{children}</div>
    </section>
  );
}

/** The “详情” (Details) table (prototype `details`): lists only rows that have a value, with a label column 88 wide. */
export function TaskFacts({ rows: items }: { rows: FactRow[] }) {
  return (
    <Section title={TASK_VIEW_COPY.factsSection}>
      <div className={facts}>
        {items.map(([label, value]) => (
          <div key={label} className={fact}>
            <span className={factLabel}>{label}</span>
            <span className={factValue}>{value}</span>
          </div>
        ))}
      </div>
    </Section>
  );
}

/**
 * Source (prototype `TaskSource`): which asset of which video this run used, and where the video folder is; for an agent task, it is the task's project.
 * A Job only records videoId and assetId; its names can only be looked up from the video open in the editor, so nothing is drawn unless it is the one that is open.
 */
export function TaskSource({ job, task }: { job?: JobRecord; task?: TaskSummary }) {
  const runtime = useRuntime();
  const video = useVideo((s) => (job?.videoId && s.video?.videoId === job.videoId ? s.video : null));
  const project = useProject(task?.projectId ?? null);
  const reveal = (target: string) => void runtime.host.revealPath(target);
  const revealButton = (target: string) => (
    <ActionButton isQuiet size="S" onPress={() => reveal(target)}>
      {TASK_VIEW_COPY.reveal}
    </ActionButton>
  );

  if (task) {
    if (!project) return null;
    return (
      <Section title={TASK_VIEW_COPY.sourceSection}>
        <div className={rows}>
          <div className={row({})}>
            <span className={rowIcon}>
              <Folder />
            </span>
            <div className={rowBody}>
              <div className={name}>{project.name}</div>
              <div className={path}>{shortenPath(project.path)}</div>
            </div>
            {revealButton(project.path)}
          </div>
        </div>
      </Section>
    );
  }

  const ref = video?.ref;
  const snapshot = video?.state?.video;
  if (!job || !ref) return null;
  // Image generation does not show the asset from the video: a media row that names the video would make it look as if this video is being generated, so only the video row is kept (prototype `source`).
  const asset = job.kind !== 'generateImage' && job.assetId ? snapshot?.assets[job.assetId] : undefined;
  const revision = asset ? asset.revisions[job.assetRevision ?? asset.currentRevision] : undefined;
  const duration = revision?.duration ? Number(revision.duration.ticks) / revision.duration.timescale : null;
  return (
    <Section title={TASK_VIEW_COPY.sourceSection}>
      <div className={rows}>
        {asset ? (
          <div className={row({})}>
            <span className={rowIcon}>
              <Filmstrip />
            </span>
            <div className={rowBody}>
              <div className={rowHead}>
                <span className={name}>{asset.name}</span>
                {duration ? <span className={mono}>{formatClock(duration)}</span> : null}
              </div>
            </div>
          </div>
        ) : null}
        <div className={row({})}>
          <span className={rowIcon}>
            <Folder />
          </span>
          <div className={rowBody}>
            <div className={name}>{snapshot?.name ?? ref.name}</div>
            <div className={path}>{shortenPath(ref.path)}</div>
          </div>
          {revealButton(ref.path)}
        </div>
      </div>
    </Section>
  );
}

/** The restricted address of one artifact; null when unavailable (the thumbnail falls back to a placeholder). */
function useArtifactUrl(artifactId: string | null): string | null {
  const runtime = useRuntime();
  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => {
    setUrl(null);
    if (!artifactId) return;
    let cancelled = false;
    runtime.openArtifact(artifactId).then(
      (handle) => !cancelled && setUrl(handle.url),
      () => {},
    );
    return () => {
      cancelled = true;
    };
  }, [runtime, artifactId]);
  return url;
}

/** Status badge for an image-generation task; its text is read at render time. */
const IMAGE_STATUS = live(
  (): Record<JobRecord['state'], { label: string; variant: 'neutral' | 'informative' | 'positive' | 'negative' }> => ({
    queued: { label: TASK_VIEW_COPY.queued, variant: 'neutral' },
    running: { label: TK.imageRunning, variant: 'informative' },
    completed: { label: TASK_VIEW_COPY.completed, variant: 'positive' },
    failed: { label: TASK_VIEW_COPY.failed, variant: 'negative' },
    cancelled: { label: TASK_VIEW_COPY.cancelled, variant: 'neutral' },
    interrupted: { label: TASK_VIEW_COPY.interrupted, variant: 'neutral' },
    'needs-reconciliation': { label: TASK_VIEW_COPY.needsReconciliation, variant: 'neutral' },
  }),
);

function ImageThumb({ job, now }: { job: JobRecord; now: number }) {
  const images = (job.result?.outputs ?? []).filter((o) => o.media.kind === 'image');
  const url = useArtifactUrl(images[0]?.artifactId ?? null);
  if (job.state === 'failed') {
    return (
      <span className={thumb({ isError: true })}>
        <AlertTriangle />
      </span>
    );
  }
  if (images.length) {
    return (
      <span className={thumb({})}>
        {url ? <img className={thumbImage} src={url} alt="" /> : <ProgressCircle size="S" isIndeterminate aria-label={TK.imageLoading} />}
        {images.length > 1 ? <span className={thumbMore}>+{images.length - 1}</span> : null}
      </span>
    );
  }
  return (
    <span className={thumb({})}>
      {job.state === 'running' && job.startedAt
        ? secs(now - Date.parse(job.startedAt))
        : job.state === 'queued'
          ? TASK_VIEW_COPY.queued
          : null}
    </span>
  );
}

/** Images (prototype `TaskImages`): the request row for an image-generation task, showing the thumbnail, status, prompt and metadata; the prompt can be copied. */
export function TaskImages({ job, now }: { job: JobRecord; now: number }) {
  const request = imageRequest(job, now);
  if (!request) return null;
  const status = IMAGE_STATUS[job.state];
  const copy = () =>
    navigator.clipboard.writeText(request.prompt).then(
      () => ToastQueue.positive(TASK_VIEW_COPY.promptCopied, { timeout: 3000 }),
      () => ToastQueue.negative(TASK_VIEW_COPY.copyFailed, { timeout: 5000 }),
    );
  return (
    <Section title={TASK_VIEW_COPY.imagesSection}>
      <div className={rows}>
        <div className={row({ top: true })}>
          <ImageThumb job={job} now={now} />
          <div className={rowBody}>
            <Badge variant={status.variant} fillStyle="subtle" size="S">
              {status.label}
            </Badge>
            <div className={prompt} style={{ display: '-webkit-box', WebkitLineClamp: 3, WebkitBoxOrient: 'vertical' }}>
              {request.prompt}
            </div>
            <div className={meta}>{request.meta}</div>
            {job.state === 'failed' && job.error ? <div className={errorText}>{jobErrorText(job.error)}</div> : null}
          </div>
          <div className={acts}>
            <ActionButton isQuiet size="S" onPress={() => void copy()}>
              <Copy />
              <Text>{TASK_VIEW_COPY.copyPrompt}</Text>
            </ActionButton>
          </div>
        </div>
      </div>
    </Section>
  );
}

const OUTPUT_ICON = { image: Image, audio: AudioWave, document: FileText } as const;

/** Artifacts (prototype “产物” section): each generated output can be opened (handed to the system browser via `artifacts.openHandle`); transcripts are written into the video. */
export function TaskOutputs({ job }: { job: JobRecord }) {
  const runtime = useRuntime();
  const outputs = jobOutputs(job);
  if (!outputs.length) return null;
  const open = (output: OutputRow) => {
    if (!output.artifactId) return;
    runtime.openArtifact(output.artifactId).then(
      (handle) => void window.open(handle.url, '_blank', 'noopener'),
      (e: Error) => ToastQueue.negative(TASK_VIEW_COPY.openFailed(e.message), { timeout: 5000 }),
    );
  };
  return (
    <Section title={TASK_VIEW_COPY.outputsSection}>
      <div className={rows}>
        {outputs.map((output) => {
          const Icon = OUTPUT_ICON[output.kind];
          return (
            <div key={output.key} className={row({})}>
              <span className={rowIcon}>
                <Icon />
              </span>
              <div className={rowBody}>
                <div className={name}>{output.name}</div>
                <div className={path}>
                  {[output.meta, output.kind !== 'document' && output.imported ? TASK_VIEW_COPY.importedToVideo : null].filter(Boolean).join(' · ')}
                </div>
              </div>
              {output.path ? (
                <ActionButton isQuiet size="S" onPress={() => void runtime.host.revealPath(output.path!)}>
                  {TASK_VIEW_COPY.reveal}
                </ActionButton>
              ) : null}
              {output.artifactId ? (
                <ActionButton isQuiet size="S" onPress={() => open(output)}>
                  {TASK_VIEW_COPY.open}
                </ActionButton>
              ) : null}
            </div>
          );
        })}
      </div>
    </Section>
  );
}
