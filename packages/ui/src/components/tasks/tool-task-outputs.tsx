import type { ReactNode } from 'react';
import type { JobRecord } from '@cuccut/protocol';
import { Button } from '@react-spectrum/s2';
import AlertTriangle from '@react-spectrum/s2/icons/AlertTriangle';
import { style } from '@react-spectrum/s2/style' with { type: 'macro' };
import type { Remedy } from '../../model/task-facts.ts';
import type { Rerun } from '../../model/tool-rerun.ts';
import { outputsDir } from '../../model/tool-outputs.ts';
import { useShell } from '../../state/shell-store.ts';
import { ToolOutputs, useJobOutputs } from '../tools/tool-outputs.tsx';
import { ENTRY_TOOL_COPY } from '../tools/tools-copy.ts';
import { goRerun } from '../tools/video-tool-parts.tsx';

/*
 * Results of tool tasks in the background task details, and “Retry / Run again” (product design §2.7 “Progress and failure”; design draft page-tasks-outputs.jsx): direct tasks and file-to-file flows list their outputs and save locations, with the same actions as the tool result page. When a direct task fails, the reason is written above “Retry”, and “重试” returns to the tool page with its parameters already filled in (direct tasks have no way to retry in place).
 */

const box = style({ display: 'flex', flexDirection: 'column', gap: 8 });
const errorRow = style({ display: 'flex', alignItems: 'start', gap: 8, font: 'ui', color: 'negative', overflowWrap: 'anywhere' });
const errorIcon = style({ display: 'flex', flexShrink: 0, marginTop: 2, color: 'red-900', '--iconPrimary': { type: 'fill', value: 'currentColor' } });
const hint = style({ font: 'ui-sm', color: 'gray-600' });
const actions = style({ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 8 });

/** “Retry / Run again”: on failure the reason is written above; configuration problems are sent elsewhere. */
export function ToolTaskRerun({ job, rerun, error, remedy }: { job: JobRecord; rerun: Rerun; error: string | null; remedy: Remedy | null }) {
  const go = useShell((s) => s.go);
  return (
    <div className={box}>
      {error ? (
        <span className={errorRow}>
          <span className={errorIcon} aria-hidden>
            <AlertTriangle />
          </span>
          <span>{remedy ? `${error} ${remedy.hint}` : error}</span>
        </span>
      ) : null}
      <div className={actions}>
        <Button variant={error ? 'accent' : 'secondary'} size="S" onPress={() => goRerun(rerun, job.jobId)}>
          {rerun.label}
        </Button>
        {remedy ? (
          <Button variant="secondary" size="S" onPress={() => go(remedy.target)}>
            {remedy.label}
          </Button>
        ) : null}
        <span className={hint}>{ENTRY_TOOL_COPY.rerunHint}</span>
      </div>
    </div>
  );
}

/** Artifacts of a tool task published into the Space; when they are not yet listed in the Space (or the task publishes no artifacts), `fallback` (the files in the task result) is drawn. */
export function ToolTaskOutputs({ job, fallback }: { job: JobRecord; fallback: ReactNode }) {
  const entries = useJobOutputs([job.jobId]);
  if (!entries.length) return <>{fallback}</>;
  return (
    // ToolOutputs brings its own "Outputs · saved in…" heading; the page column spaces it like the other sections.
    <ToolOutputs entries={entries} saveDir={outputsDir(entries)} panel />
  );
}
