import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

/**
 * The choice remembered per tool on the AI tools page's "use" row (prototype tool-setup.jsx `useRunner`'s `runnerBy[tool]`): hand off to the Agent or call the model directly,
 * and, when calling directly, which text model to use (`providerId/modelId`). It is only a UI preference, stored on this machine across sessions (also available on the Web), and not in the Runtime's settings.
 * Which provider · model to use when handing off to the Agent is not here: that is the default for new sessions (the same single source as the chip in the input bar's footer).
 */
export type AiToolRunner = 'agent' | 'model';

export interface AiToolRunnerStore {
  runners: Record<string, AiToolRunner>;
  models: Record<string, string>;
  setRunner(tool: string, runner: AiToolRunner): void;
  setModel(tool: string, key: string): void;
}

export const useAiToolRunner = create<AiToolRunnerStore>()(
  persist(
    (set) => ({
      runners: {},
      models: {},
      setRunner: (tool, runner) => set((s) => ({ runners: { ...s.runners, [tool]: runner } })),
      setModel: (tool, key) => set((s) => ({ models: { ...s.models, [tool]: key } })),
    }),
    {
      name: 'cuccut.ai-tool-runner',
      version: 1,
      storage: createJSONStorage(() => localStorage),
      partialize: ({ runners, models }) => ({ runners, models }),
    },
  ),
);
