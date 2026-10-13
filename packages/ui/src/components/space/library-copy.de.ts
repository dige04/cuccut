import type { LibraryMessages } from './library-copy.ts';

export const de: LibraryMessages = {
  blurb: 'Videos, Medien und alles, was deine Agenten erstellt haben, aus allen Projekten.',
  blurbProject: 'Videos, Medien und Ergebnisse in diesem Projekt.',
  blurbFavorite: 'Alles, was du als Favorit markiert hast, aus allen Projekten.',
  blurbTrash: 'Elemente im Papierkorb bleiben hier, bis du sie wiederherstellst oder dauerhaft löschst.',
  allItems: 'Alle Elemente',
  projects: 'Projekte',
  items: (n: number) => (n === 1 ? '1 Element' : `${n} Elemente`),
  matching: (n: number, q: string) => `${n === 1 ? '1 Element passt' : `${n} Elemente passen`} zu „${q}“`,
  kindFilter: 'Art des Elements',
  clearSearch: 'Suche löschen',
  noMatchBody: 'Versuche einen anderen Namen oder wechsle die Art.',
  openHint: 'Zum Ansehen öffnen · Videos öffnen sich im Editor',
  inProject: (name: string) => `In ${name}`,
  clearProject: 'Alle Projekte zeigen',
  backToLibrary: 'Zurück zur Bibliothek',
};
