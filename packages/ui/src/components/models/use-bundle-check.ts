import { useCallback, useEffect, useState } from 'react';
import type { JobRecord, ModelBundleStatus } from '@cuccut/protocol';
import { ToastQueue } from '@react-spectrum/s2';
import { checkRoute, checkState, repairOutcome, type CheckAbilities, type CheckState } from '../../model/model-check.ts';
import type { CheckSubject } from '../../model/model-check-copy.ts';
import { bundleActions, problemText, rpcProblem } from '../../model/models-install.ts';
import { useRuntime } from '../../runtime/context.tsx';
import { useModelCheck } from '../../state/model-check-store.ts';
import { stopInstall } from './local-model-actions.ts';
import { LOCAL_INSTALL_COPY as INSTALL } from './local-models-copy.ts';
import { startCheck } from './start-check.ts';

export interface BundleCheck {
  state: CheckState;
  can: CheckAbilities;
  /** The submit request for the check has not returned yet. */
  starting: boolean;
  /** Check (a disabled model is re-enabled first); if rejected, it is recorded and written on the status line, no toast. */
  start: () => Promise<void>;
  /** Cancel the check (task cancelled) or repair (stop and discard the partial download): the status goes back to the one before. */
  cancel: () => void;
  /** The repair dialog submitted a task: record it, and check again automatically when it finishes. */
  repairStarted: (jobId: string) => void;
}

/**
 * The “检查”(Check) for one model package row (model/model-check.ts): status is computed from the `jobs` / `models` topics; a rejected submit and a repair started from this row are recorded in state/model-check-store.ts. After a repair task completes, a check runs once more automatically; if it fails, is cancelled or is interrupted, no check runs, and the reason stays written on the row.
 * `ownFiles`: the model package's own files are on disk (the same-named parameter of `bundleActions`); a model with weights present but missing components can also be repaired.
 */
export function useBundleCheck(
  bundle: ModelBundleStatus,
  subject: CheckSubject,
  jobs: readonly JobRecord[],
  ownFiles: boolean,
): BundleCheck {
  const runtime = useRuntime();
  const id = bundle.bundleId;
  const rejection = useModelCheck((s) => s.rejections[id] ?? null);
  const repairJobId = useModelCheck((s) => s.repairs[id] ?? null);
  const [starting, setStarting] = useState(false);
  const state = checkState({ bundle, jobs, subject, rejection, repairJobId });
  const route = checkRoute(bundle);
  const can: CheckAbilities = { repair: bundleActions(bundle, ownFiles).repair && state.phase !== 'repairing', recheck: route !== null };

  const start = useCallback(async () => {
    setStarting(true);
    try {
      await startCheck(runtime, id);
    } finally {
      setStarting(false);
    }
  }, [runtime, id]);

  const repairEnd = repairOutcome(jobs, repairJobId);
  useEffect(() => {
    // Only recognizes the one still recorded: the same completion triggers one check only (effects run twice in development mode).
    const store = useModelCheck.getState();
    if (!repairEnd || !repairJobId || store.repairs[id] !== repairJobId) return;
    store.setRepair(id, null);
    if (repairEnd === 'check') void start();
  }, [repairEnd, repairJobId, id, start]);

  const cancel = () => {
    if (state.phase === 'checking') {
      runtime.cancelJob(state.jobId).catch((e: Error) => ToastQueue.negative(INSTALL.stopFailed(e.message), { timeout: 5000 }));
    } else if (state.phase === 'repairing') {
      useModelCheck.getState().setRepair(id, null);
      stopInstall(runtime, id, true).catch((e: unknown) =>
        ToastQueue.negative(INSTALL.stopFailed(problemText(rpcProblem(e))), { timeout: 8000 }),
      );
    }
  };

  const repairStarted = (jobId: string) => useModelCheck.getState().setRepair(id, jobId);

  return { state, can, starting, start, cancel, repairStarted };
}
