import { useEffect, useRef } from 'react';
import { ToastQueue } from '@react-spectrum/s2';
import { REMOTE_COPY, SERVICES_PAGE_COPY } from '../../copy.ts';
import { liveApprovalCount } from '../../model/services-mcp.ts';
import { serviceStates, servicesAlert, type ServiceStates } from '../../model/services.ts';
import { useRuntime } from '../../runtime/context.tsx';
import { useConnection } from '../../state/connection-store.ts';
import { useServices } from '../../state/services-store.ts';
import { useShare } from '../../state/share-store.ts';
import { useNow } from '../use-now.ts';
import { flipShare, refreshNodes, refreshShare } from './share-commands.ts';

/**
 * The node protocol has no topic subscription (`nodes.*` only has requests), so shared status is polled:
 * - Read once on every connection to the Runtime (the rail badge and the sidebar light rely on it), and cleared on disconnect so stale state is not reported as an error;
 * - While the services page is open and the window is in the foreground, `nodes.share.status` is read every 5 seconds (a local request, so cheap);
 * - While “Use other computers” is on, `nodes.list` is read every 15 seconds (each node is probed live, up to 2 seconds).
 * Polling stops when the window goes to the background, and reads once immediately when it returns to the foreground.
 */
export const SHARE_POLL_MS = 5_000;
export const NODES_POLL_MS = 15_000;

function useConnectionId(): string | null {
  return useConnection((s) => (s.state.status === 'connected' ? s.state.connectionId : null));
}

function useVisiblePolling(task: () => void, intervalMs: number, enabled: boolean) {
  const latest = useRef(task);
  useEffect(() => {
    latest.current = task;
  });
  useEffect(() => {
    if (!enabled) return;
    let timer: ReturnType<typeof setInterval> | null = null;
    const stop = () => {
      if (timer !== null) clearInterval(timer);
      timer = null;
    };
    const sync = () => {
      if (document.visibilityState !== 'visible') return stop();
      if (timer !== null) return;
      latest.current();
      timer = setInterval(() => latest.current(), intervalMs);
    };
    sync();
    document.addEventListener('visibilitychange', sync);
    return () => {
      stop();
      document.removeEventListener('visibilitychange', sync);
    };
  }, [intervalMs, enabled]);
}

/** Reads the shared state once on connect, and clears it on disconnect. Mounted only once, in the always-present place (the rail). */
function useShareOnConnect() {
  const runtime = useRuntime();
  const connectionId = useConnectionId();
  useEffect(() => {
    if (!connectionId) {
      useShare.getState().setStatus(null);
      useShare.getState().setNodes(null);
      return;
    }
    void refreshShare(runtime);
  }, [runtime, connectionId]);
}

/** Polls the shared state while the services page is open. */
export function useSharePolling() {
  const runtime = useRuntime();
  const connectionId = useConnectionId();
  useVisiblePolling(() => void refreshShare(runtime), SHARE_POLL_MS, connectionId !== null);
}

/** Polls the paired nodes while “Use other computers” is on. */
export function useNodesPolling() {
  const runtime = useRuntime();
  const connectionId = useConnectionId();
  useVisiblePolling(() => void refreshNodes(runtime), NODES_POLL_MS, connectionId !== null);
}

/**
 * On connecting to the Runtime, subscribes to the `services` topic (architecture design §4.8; command and protocol spec §10.4), and clears the mirror on disconnect. The client keeps only one subscription per topic,
 * so it is mounted only once, in the always-present place (the rail). After reconnection the client resubscribes itself and resends the snapshot.
 */
function useServicesTopic() {
  const runtime = useRuntime();
  const connectionId = useConnectionId();
  useEffect(() => {
    if (!connectionId) {
      useServices.getState().reset();
      return;
    }
    return runtime.watchServices({
      snapshot: (snapshot) => useServices.getState().replace(snapshot),
      event: (event) => useServices.getState().apply(event),
    });
  }, [runtime, connectionId]);
}

/** The status of the four services right now (shared by the overview, sidebar and rail): MCP, Web and model API read the `services` topic; remote compute has its own shared-status polling. */
export function useServiceStates(): ServiceStates {
  const services = useServices((s) => s.services);
  const share = useShare((s) => s.status);
  const phase = useShare((s) => s.phase);
  return serviceStates(services, share, phase);
}

/** Start or stop sharing (shared by the service card and the overview row): on success, shows a hint; on failure, says the cause. */
export function useFlipShare(): (on: boolean) => void {
  const runtime = useRuntime();
  return (on) => {
    flipShare(runtime, on)
      .then((status) => {
        if (!status) return;
        if (!on) ToastQueue.neutral(REMOTE_COPY.stopped, { timeout: 3000 });
        else if (status.listening) ToastQueue.positive(REMOTE_COPY.started, { timeout: 3000 });
      })
      .catch((error: Error) => ToastQueue.negative(SERVICES_PAGE_COPY.failed(error.message), { timeout: 5000 }));
  };
}

/**
 * Badge on the rail's “Services”: when a service is in error, or external client requests are waiting for confirmation (service approval, 50-second deadline), it gives a sentence for screen readers; otherwise null.
 * It also reads the shared state once on connect and subscribes to the `services` topic. While approvals are waiting, it recomputes every second; approvals past their deadline are no longer counted.
 */
export function useServicesAlert(): string | null {
  useShareOnConnect();
  useServicesTopic();
  const approvals = useServices((s) => s.approvals);
  const now = useNow(1000, approvals.length > 0);
  return servicesAlert(useServiceStates(), liveApprovalCount(approvals, now));
}
