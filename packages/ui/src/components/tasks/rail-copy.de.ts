import type { RailMessages } from './rail-copy.ts';

export const de: RailMessages = {
  running: (n: number) => `${n} laufend`,
  finished: (n: number) => `${n} abgeschlossen`,
  nothingYet: 'Noch nichts',
  tasksBlurb: 'Transkription, Übersetzung, Exporte und die Arbeit der Agenten in einer Liste. Öffne eine Aufgabe, um ihre Schritte und Ergebnisse zu sehen.',
  toolCount: (n: number) => (n === 1 ? '1 Werkzeug' : `${n} Werkzeuge`),
  moreFinished: (n: number) => `${n} weitere unter Alle Aufgaben`,
};
