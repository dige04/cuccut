import type { RailMessages } from './rail-copy.ts';

export const fr: RailMessages = {
  running: (n: number) => `${n} en cours`,
  finished: (n: number) => (n <= 1 ? `${n} terminée` : `${n} terminées`),
  nothingYet: 'Rien pour l’instant',
  tasksBlurb: 'Transcription, traduction, exports et travail des agents, dans une seule liste. Ouvrez une tâche pour voir ses étapes et ses résultats.',
  toolCount: (n: number) => (n <= 1 ? `${n} outil` : `${n} outils`),
  moreFinished: (n: number) => `${n} de plus dans Toutes les tâches`,
};
