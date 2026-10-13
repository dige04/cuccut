import type { Id, ModelInstallPlan, ModelInstallResult, ModelRemoveResult } from '@cuccut/protocol';
import type { RuntimeSession } from '../../runtime/session.ts';

/**
 * Commands for local model packages (architecture design §6.3): install and repair with their two-step confirmation, stop, delete, and check. The new state and progress of model packages are sent back by the `models` topic; this code does not change local state. Failures are thrown as-is to the caller (the dialog keeps the reason, or a toast is shown).
 */

type Session = Pick<
  RuntimeSession,
  'installModelBundle' | 'repairModelBundle' | 'cancelModelInstall' | 'removeModelBundle' | 'testModelBundle'
>;

/**
 * `complete`: for a model package whose own files are on disk, fills in the missing components (optional components, or shared components brought by another model). It uses the same request as `install` (the plan only contains the missing pieces), but does not ask for license again and has a different title.
 */
export type InstallMode = 'install' | 'complete' | 'repair';

function call(session: Session, mode: InstallMode, bundleId: string, confirmBytes?: number): Promise<ModelInstallResult> {
  return mode === 'repair' ? session.repairModelBundle(bundleId, confirmBytes) : session.installModelBundle(bundleId, confirmBytes);
}

/** Step 1: fetches the plan only, no download (on repair, the Runtime first verifies the files already installed). */
export function planInstall(session: Session, mode: InstallMode, bundleId: string): Promise<ModelInstallResult> {
  return call(session, mode, bundleId);
}

export type ConfirmOutcome =
  /** An install task was submitted (if the same model package is already being installed, that task is returned). */
  | { kind: 'started'; jobId: Id }
  /** The size to download changed: confirm again with the new plan. */
  | { kind: 'replan'; plan: ModelInstallPlan }
  /** Already complete, nothing to download. */
  | { kind: 'up-to-date'; plan: ModelInstallPlan };

/** Step 2: passes back `confirmBytes` from the plan unchanged. When the size has changed (`MODEL_INSTALL_SIZE_CHANGED`), the new plan is returned, not treated as a failure. */
export async function confirmInstall(session: Session, mode: InstallMode, plan: ModelInstallPlan): Promise<ConfirmOutcome> {
  let result: ModelInstallResult;
  try {
    result = await call(session, mode, plan.bundleId, plan.confirmBytes);
  } catch (error) {
    const details = (error as { details?: { code?: unknown; plan?: ModelInstallPlan } } | null)?.details;
    if (details?.code === 'MODEL_INSTALL_SIZE_CHANGED' && details.plan) return { kind: 'replan', plan: details.plan };
    throw error;
  }
  if (result.jobId) return { kind: 'started', jobId: result.jobId };
  return result.plan.upToDate ? { kind: 'up-to-date', plan: result.plan } : { kind: 'replan', plan: result.plan };
}

/** Stops the install: when `discard` is false, the parts already received are kept (resume next time); when true, they are deleted too. */
export async function stopInstall(session: Session, bundleId: string, discard: boolean): Promise<void> {
  await session.cancelModelInstall(bundleId, discard);
}

/** Deletes a model package; shared components still used by other model packages are kept by the Runtime and listed in the result. */
export function removeBundle(session: Session, bundleId: string): Promise<ModelRemoveResult> {
  return session.removeModelBundle(bundleId);
}

/** Check: returns a task ID; the conclusion is recorded in the model package's `selfTest`. */
export function startSelfTest(session: Pick<Session, 'testModelBundle'>, bundleId: string): Promise<Id> {
  return session.testModelBundle(bundleId);
}
