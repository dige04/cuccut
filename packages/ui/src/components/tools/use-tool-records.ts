import { useCallback, useEffect, useMemo, useState } from 'react';
import type { JobKind, JobRecord } from '@cuccut/protocol';
import { ToastQueue } from '@react-spectrum/s2';
import { rejectionRemedy } from '../../model/task-facts.ts';
import { reconcileOptions } from '../../model/task-reconcile.ts';
import { liveCount, toolJobs } from '../../model/tools-records.ts';
import { useRuntime } from '../../runtime/context.tsx';
import { useJobs } from '../../state/jobs-store.ts';
import { useShell } from '../../state/shell-store.ts';
import { useTools } from '../../state/tools-store.ts';
import { RECORD_COPY } from './tools-copy.ts';

/** Records for this kind of tool: jobs in the `jobs` topic submitted from this computer's UI that do not belong to a video, minus those hidden locally. `all` is used for queue position. */
export function useToolRecords(kind: JobKind): { ready: boolean; list: JobRecord[]; all: JobRecord[]; live: number } {
  const ready = useJobs((s) => s.ready);
  const all = useJobs((s) => s.jobs);
  const hidden = useTools((s) => s.hidden);
  const list = useMemo(() => toolJobs(all, kind, hidden), [all, kind, hidden]);
  return { ready, list, all, live: liveCount(list) };
}

/** Cancels a running or queued record (`jobs.cancel`); the result comes as a topic event; shows a hint on failure. */
export function useCancelJob(): (jobId: string) => void {
  const runtime = useRuntime();
  return useCallback(
    (jobId: string) => {
      runtime.cancelJob(jobId).catch((e: Error) => ToastQueue.negative(RECORD_COPY.cancelFailed(e.message), { timeout: 5000 }));
    },
    [runtime],
  );
}

/**
 * The hint when a submission is rejected: when configuration is missing (`CAPABILITY_NOT_CONFIGURED`), show the sentence the Runtime gives, with a button to where to fix it; otherwise show the reason as-is.
 */
export function useSubmitFailed(kind: JobKind, text: (message: string) => string): (error: Error) => void {
  const go = useShell((s) => s.go);
  return useCallback(
    (error: Error) => {
      const remedy = rejectionRemedy(kind, error);
      if (!remedy) {
        ToastQueue.negative(text(error.message), { timeout: 6000 });
        return;
      }
      // Hints with a button do not auto-dismiss (S2 accessibility requirement).
      ToastQueue.negative(text(remedy.hint || error.message), {
        actionLabel: remedy.label,
        onAction: () => go(remedy.target),
        shouldCloseOnAction: true,
      });
    },
    [go, kind, text],
  );
}

/**
 * “retry / re-queue” for unfinished records. If the job was interrupted and the Runtime allows an in-place rerun, it goes through `jobs.reconcile` retry (the same job is queued again, not a new one); otherwise a new job is submitted with the frozen parameters (`resubmit` returns null when the parameters are incomplete and it cannot be submitted). `pending` while in progress; after a successful resubmit the record is marked `done` and the button is no longer shown, so repeated or later clicks never charge twice. Results of unknown state are not handled here; reconcile them in the job details.
 */
export function useRecordRetry(
  job: JobRecord,
  kind: JobKind,
  resubmit: (job: JobRecord) => Promise<unknown> | null,
  copy: { submitted: string; failed: (message: string) => string },
): { retry: () => void; pending: boolean; done: boolean } {
  const runtime = useRuntime();
  const done = useTools((s) => s.retried.includes(job.jobId));
  const markRetried = useTools((s) => s.markRetried);
  const failed = useSubmitFailed(kind, copy.failed);
  const [pending, setPending] = useState(false);
  const inPlace = reconcileOptions(job).includes('retry') && job.state === 'interrupted';
  const retry = () => {
    if (pending || done) return;
    const request = inPlace ? runtime.reconcileJob(job.jobId, 'retry') : resubmit(job);
    if (!request) return;
    setPending(true);
    request
      .then(() => {
        if (!inPlace) markRetried(job.jobId);
        ToastQueue.positive(copy.submitted, { timeout: 3000 });
      }, failed)
      .finally(() => setPending(false));
  };
  return { retry, pending, done };
}

export type MediaUrl = { status: 'loading' } | { status: 'ready'; url: string } | { status: 'failed'; message: string };

/**
 * The restricted address of an artifact (`artifacts.openHandle`), for `<audio>` and `<img>`. A handle is valid for one hour and is renewed on each read, which is enough while the page is open; each card fetches it once on mount.
 */
export function useArtifactUrl(artifactId: string | null): MediaUrl | null {
  const runtime = useRuntime();
  const [state, setState] = useState<{ id: string; media: MediaUrl } | null>(null);
  useEffect(() => {
    if (!artifactId) return;
    let live = true;
    runtime.openArtifact(artifactId).then(
      (handle) => live && setState({ id: artifactId, media: { status: 'ready', url: handle.url } }),
      (e: Error) => live && setState({ id: artifactId, media: { status: 'failed', message: e.message } }),
    );
    return () => {
      live = false;
    };
  }, [runtime, artifactId]);
  if (!artifactId) return null;
  return state?.id === artifactId ? state.media : { status: 'loading' };
}

/**
 * Downloads an artifact: gets the restricted address, reads it as a Blob, and hands it to the browser through `<a download>` (on desktop, the system download). If the address cannot be read as a Blob, it falls back to opening it in a new window. Failures are thrown as-is.
 */
export function useDownloadArtifact(): (artifactId: string, fileName: string) => Promise<void> {
  const runtime = useRuntime();
  return useCallback(
    async (artifactId: string, fileName: string) => {
      const handle = await runtime.openArtifact(artifactId);
      let href: string;
      let revoke = false;
      try {
        const response = await fetch(handle.url);
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        href = URL.createObjectURL(await response.blob());
        revoke = true;
      } catch {
        window.open(handle.url, '_blank', 'noopener');
        return;
      }
      const a = document.createElement('a');
      a.href = href;
      a.download = fileName;
      a.rel = 'noopener';
      document.body.appendChild(a);
      a.click();
      a.remove();
      if (revoke) setTimeout(() => URL.revokeObjectURL(href), 60_000);
    },
    [runtime],
  );
}

/** Copies a piece of text; shows a hint on success or failure. */
export function copyText(text: string): void {
  navigator.clipboard.writeText(text).then(
    () => ToastQueue.positive(RECORD_COPY.copied, { timeout: 3000 }),
    () => ToastQueue.negative(RECORD_COPY.copyFailed, { timeout: 4000 }),
  );
}
