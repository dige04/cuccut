import { create } from 'zustand';
import type { PairedNode, ShareStatus } from '@cuccut/protocol';
import type { ServicePhase } from '../model/services.ts';

/**
 * Mirror of remote compute: the latest result of `nodes.share.status`, the one or two seconds while starting or stopping, and the latest `nodes.list` of paired nodes.
 * The node protocol has no subscription topic, so the services page polls to refresh while visible (see components/services/use-share-status.ts); the rail badge and the sidebar light read the same copy.
 */
export interface ShareStore {
  status: ShareStatus | null;
  phase: ServicePhase | null;
  nodes: PairedNode[] | null;
  setStatus(status: ShareStatus | null): void;
  setPhase(phase: ServicePhase | null): void;
  setNodes(nodes: PairedNode[] | null): void;
}

export const useShare = create<ShareStore>()((set) => ({
  status: null,
  phase: null,
  nodes: null,
  setStatus: (status) => set({ status }),
  setPhase: (phase) => set({ phase }),
  setNodes: (nodes) => set({ nodes }),
}));
