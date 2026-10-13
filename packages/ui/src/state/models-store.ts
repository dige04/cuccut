import { create } from 'zustand';
import { applyModelsEvent } from '@cuccut/client';
import type { ModelBundleStatus, ModelCapabilitiesView, ModelsEvent, ModelsSnapshot } from '@cuccut/protocol';

/** Read-only view mirror of the model services (architecture design §6.8): for each capability, each Provider's models, defaults and availability, plus the state of local model packages. */
export interface ModelsStore {
  ready: boolean;
  capabilities: ModelCapabilitiesView | null;
  bundles: ModelBundleStatus[];
  replace(snapshot: ModelsSnapshot): void;
  apply(event: ModelsEvent): void;
}

export const useModels = create<ModelsStore>()((set) => ({
  ready: false,
  capabilities: null,
  bundles: [],
  replace: (snapshot) => set({ ready: true, capabilities: snapshot.capabilities, bundles: snapshot.bundles }),
  apply: (event) =>
    set((s) => {
      // No bundle events arrive before the snapshot. If one does come, just record that one package first.
      const base: ModelsSnapshot = { capabilities: s.capabilities as ModelCapabilitiesView, bundles: s.bundles };
      const next = applyModelsEvent(base, event);
      return { ready: next.capabilities !== null, capabilities: next.capabilities, bundles: next.bundles };
    }),
}));
