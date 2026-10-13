import type { RailMessages } from './rail-copy.ts';

export const pl: RailMessages = {
  running: (n: number) => `W toku: ${n}`,
  finished: (n: number) => `Ukończone: ${n}`,
  nothingYet: 'Jeszcze nic',
  tasksBlurb: 'Transkrypcja, tłumaczenie, eksporty i praca agentów na jednej liście. Otwórz zadanie, aby zobaczyć jego kroki i wyniki.',
  toolCount: (n: number) => `Narzędzia: ${n}`,
  moreFinished: (n: number) => `Jeszcze ${n} we Wszystkich zadaniach`,
};
