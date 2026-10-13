import { checkRoute, rejectionOf } from '../../model/model-check.ts';
import type { RuntimeSession } from '../../runtime/session.ts';
import { useModelCheck } from '../../state/model-check-store.ts';
import { useModels } from '../../state/models-store.ts';
import { startSelfTest } from './local-model-actions.ts';

/**
 * Submits a check: a model that is disabled (its last load failed) is re-enabled first. If it is rejected, it is recorded in the store and written on the status line, no toast.
 * It uses the model package state at the moment of submission: when a check runs automatically after a repair, the model package may have just changed.
 */
export async function startCheck(session: Pick<RuntimeSession, 'enableModelBundle' | 'testModelBundle'>, bundleId: string): Promise<void> {
  const store = useModelCheck.getState();
  store.reject(bundleId, null);
  try {
    const latest = useModels.getState().bundles.find((b) => b.bundleId === bundleId);
    if (latest && checkRoute(latest) === 'enable-then-test') await session.enableModelBundle(bundleId);
    await startSelfTest(session, bundleId);
  } catch (error) {
    store.reject(bundleId, rejectionOf(error));
  }
}
