import type { RailMessages } from './rail-copy.ts';

export const it: RailMessages = {
  running: (n: number) => `${n} in corso`,
  finished: (n: number) => (n === 1 ? '1 completata' : `${n} completate`),
  nothingYet: 'Ancora niente',
  tasksBlurb: 'Trascrizione, traduzione, esportazioni e il lavoro degli agenti, in un’unica lista. Apri un’attività per vederne i passaggi e i risultati.',
  toolCount: (n: number) => (n === 1 ? '1 strumento' : `${n} strumenti`),
  moreFinished: (n: number) => `Altre ${n} in Tutte le attività`,
};
