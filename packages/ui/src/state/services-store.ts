import { create } from 'zustand';
import { applyServicesEvent } from '@cuccut/client';
import type { ServiceApproval, ServiceStatus, ServicesEvent, ServicesSnapshot } from '@cuccut/protocol';

/**
 * Mirror of external services (architecture design §4.8; the `services` topic in the command and protocol spec §10.4): the state, configuration, clients and recent requests of each service,
 * plus pending service approvals. It is rewritten only by the Runtime's snapshots and events. The subscription is opened by a hook that stays mounted in the rail (`RuntimeSession.watchServices`)
 * and cleared on disconnect, so stale state is never reported as an error. The overview, the sidebar light, the rail badge and each service page read the same copy.
 */
export interface ServicesStore {
  ready: boolean;
  services: ServiceStatus[];
  approvals: ServiceApproval[];
  replace(snapshot: ServicesSnapshot): void;
  apply(event: ServicesEvent): void;
  reset(): void;
}

export const useServices = create<ServicesStore>()((set) => ({
  ready: false,
  services: [],
  approvals: [],
  replace: (snapshot) => set({ ready: true, services: snapshot.services, approvals: snapshot.approvals }),
  apply: (event) => set((s) => applyServicesEvent({ services: s.services, approvals: s.approvals }, event)),
  reset: () => set({ ready: false, services: [], approvals: [] }),
}));
