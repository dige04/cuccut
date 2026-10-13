import { localizeText, type JobRecord } from '@cuccut/protocol';
import { M } from '../cli-copy.ts';

/**
 * Progress while waiting for a task (agent-surface design §5.1, §5.4), always written to stderr, never touching the stdout JSON:
 *
 * - `--progress jsonl`: one event per line `{ type: 'progress' | 'artifact' | 'warning' | 'done', jobId, … }`; `progress` carries
 *   `state`, `stage` (the task's stage) and `pct` (null when there is no total).
 * - Default: when stderr is a TTY, one line refreshed in place; otherwise one line written on each state change.
 */
export type ProgressMode = 'jsonl' | 'text';

type Stream = NodeJS.WritableStream & { isTTY?: boolean };

export class ProgressReporter {
  readonly #mode: ProgressMode;
  readonly #stream: Stream;
  readonly #tty: boolean;
  #last = '';
  #open = false;
  readonly #warnings = new Set<string>();
  readonly #artifacts = new Set<string>();

  constructor(mode: ProgressMode | undefined, stream: Stream) {
    this.#mode = mode ?? 'text';
    this.#stream = stream;
    this.#tty = Boolean(stream.isTTY);
  }

  /** The task record changed. */
  update(job: JobRecord): void {
    const pct = percent(job);
    if (this.#mode === 'jsonl') {
      const key = `${job.state}|${job.phase}|${pct === null ? '' : Math.floor(pct)}`;
      if (key !== this.#last) {
        this.#last = key;
        this.#event({
          type: 'progress',
          jobId: job.jobId,
          state: job.state,
          stage: job.phase,
          pct: pct === null ? null : Math.round(pct * 10) / 10,
        });
      }
    } else {
      const line = `${job.jobId} · ${job.state} · ${job.phase}${pct === null ? '' : ` ${pct.toFixed(0)}%`}${job.attempt > 1 ? ` (#${job.attempt})` : ''}`;
      if (line !== this.#last) {
        this.#last = line;
        this.#line(line);
      }
    }
    for (const warning of job.warnings) {
      const key = `${warning.code}|${warning.detail ?? ''}`;
      if (this.#warnings.has(key)) continue;
      this.#warnings.add(key);
      const detail = localizeText(warning.detail, warning.detailRef) ?? null;
      if (this.#mode === 'jsonl') this.#event({ type: 'warning', jobId: job.jobId, code: warning.code, detail });
      else this.#message(`[warning] ${warning.code}${detail ? `: ${detail}` : ''}`);
    }
    for (const output of job.result?.outputs ?? []) {
      if (this.#artifacts.has(output.artifactId)) continue;
      this.#artifacts.add(output.artifactId);
      if (this.#mode === 'jsonl')
        this.#event({ type: 'artifact', jobId: job.jobId, artifactId: output.artifactId, mediaType: output.mediaType });
    }
  }

  done(job: JobRecord): void {
    if (this.#mode === 'jsonl')
      this.#event({ type: 'done', jobId: job.jobId, state: job.state, ...(job.error ? { code: job.error.code } : {}) });
    else this.#close();
  }

  /** One line of explanation (cancelling, wait timed out). */
  note(text: string): void {
    if (this.#mode === 'jsonl') return;
    this.#message(text);
  }

  cancelling(jobId: string): void {
    if (this.#mode === 'jsonl') this.#event({ type: 'cancelling', jobId });
    else this.#message(M.jobCancelling(jobId));
  }

  #event(event: Record<string, unknown>): void {
    this.#stream.write(`${JSON.stringify(event)}\n`);
  }

  #line(text: string): void {
    if (this.#tty) {
      this.#stream.write(`\r\x1b[K${text}`);
      this.#open = true;
    } else this.#stream.write(`${text}\n`);
  }

  #message(text: string): void {
    this.#close();
    this.#stream.write(`${text}\n`);
  }

  #close(): void {
    if (!this.#open) return;
    this.#stream.write('\n');
    this.#open = false;
  }
}

function percent(job: JobRecord): number | null {
  const progress = job.progress;
  if (!progress || progress.total === null || progress.total <= 0) return null;
  return Math.min(100, (progress.done / progress.total) * 100);
}
