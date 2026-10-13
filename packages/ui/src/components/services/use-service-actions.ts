import { useCallback } from 'react';
import type { ServiceConfigureParams, ServiceStatus } from '@cuccut/protocol';
import { ToastQueue } from '@react-spectrum/s2';
import { SERVICE_COPY, SERVICES_PAGE_COPY } from '../../copy.ts';
import { runtimeServiceId, serviceErrorMessage, type ServiceId } from '../../model/services.ts';
import { useRuntime } from '../../runtime/context.tsx';
import { useServices } from '../../state/services-store.ts';
import { COMMON_COPY } from './services-copy.ts';
import { useFlipShare } from './use-share-status.ts';

/*
 * Actions for the services page (architecture design §4.8): start/stop, change config, copy. Results all come back to services-store through the `services` topic.
 * Here, the returned state is first written into the mirror once (the topic event arrives afterwards with the same content), and a hint is shown.
 */

/** Writes the new state of one service into the mirror (it does not wait for the topic event, so the button catches up immediately). */
export function putService(service: ServiceStatus) {
  useServices.getState().apply({ type: 'service.updated', service });
}

function failed(error: unknown) {
  ToastQueue.negative(SERVICES_PAGE_COPY.failed(serviceErrorMessage(error)), { timeout: 5000 });
}

/**
 * Start or stop one service (shared by the overview row and the service card). Remote compute goes through `nodes.share.*` (its shared state is finer-grained; see use-share-status.ts).
 * The rest go through `services.start` / `services.stop`. When the port is occupied, `services.start` still returns normally with status `error`; the cause is shown then.
 */
export function useFlipService(id: ServiceId): (on: boolean) => void {
  const runtime = useRuntime();
  const flipShare = useFlipShare();
  return useCallback(
    (on: boolean) => {
      if (id === 'remote') return flipShare(on);
      const name = SERVICE_COPY[id].name;
      const serviceId = runtimeServiceId(id);
      (on ? runtime.startService(serviceId) : runtime.stopService(serviceId))
        .then((service) => {
          putService(service);
          if (!on) ToastQueue.neutral(COMMON_COPY.stopped(name), { timeout: 3000 });
          else if (service.state === 'error') ToastQueue.negative(COMMON_COPY.startFailed(service.error ?? COMMON_COPY.errorFix), { timeout: 5000 });
          else ToastQueue.positive(COMMON_COPY.started(name), { timeout: 3000 });
        })
        .catch(failed);
    },
    [runtime, flipShare, id],
  );
}

/**
 * Change the config of one service: takes effect immediately. On success it shows the `done` message (if none is given, no hint is shown); on failure it says the cause. Returns whether it succeeded.
 * If a running (or errored) service has its port changed, it restarts on the new port. If the new port is occupied, the config is still saved and the service enters `error`; then it says the restart failed, and why.
 */
export function useConfigureService(): (params: ServiceConfigureParams, done?: string) => Promise<boolean> {
  const runtime = useRuntime();
  return useCallback(
    async (params, done) => {
      try {
        const before = useServices.getState().services.find((s) => s.serviceId === params.serviceId);
        const service = await runtime.configureService(params);
        putService(service);
        // If it was working before, or was already in error but the cause has changed this time (e.g. switched to another port to avoid the occupied one, and the new one is also occupied), always say so. If the cause is unchanged, don't repeat it.
        if (service.state === 'error' && (before?.state !== 'error' || before.error !== service.error))
          ToastQueue.negative(COMMON_COPY.restartFailed(service.error ?? COMMON_COPY.errorFix), { timeout: 5000 });
        else if (done) ToastQueue.neutral(done, { timeout: 3000 });
        return true;
      } catch (error) {
        failed(error);
        return false;
      }
    },
    [runtime],
  );
}

/** Copies to the clipboard and shows “…copied”; when the clipboard is unavailable, asks the user to select and copy manually. */
export function copyText(text: string, label: string) {
  if (!navigator.clipboard) {
    ToastQueue.negative(COMMON_COPY.copyFailed, { timeout: 5000 });
    return;
  }
  navigator.clipboard.writeText(text).then(
    () => ToastQueue.positive(COMMON_COPY.copied(label), { timeout: 2000 }),
    () => ToastQueue.negative(COMMON_COPY.copyFailed, { timeout: 5000 }),
  );
}

/** Generic failure message (shared by the client, alias, session and other sub-actions). */
export const toastFailure = failed;
