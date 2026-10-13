import type { RailMessages } from './rail-copy.ts';

export const nl: RailMessages = {
  running: (n: number) => `${n} bezig`,
  finished: (n: number) => `${n} klaar`,
  nothingYet: 'Nog niets',
  tasksBlurb: 'Transcriptie, vertaling, exports en het werk van agents in één lijst. Open een taak om de stappen en resultaten te zien.',
  toolCount: (n: number) => (n === 1 ? '1 tool' : `${n} tools`),
  moreFinished: (n: number) => `Nog ${n} in Alle taken`,
};
