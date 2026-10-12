import type { SlidesMessages } from './slides-copy.ts';

const list = (labels: readonly string[]) => new Intl.ListFormat('pl', { type: 'conjunction' }).format(labels);

export const pl: SlidesMessages = {
  pages: (n) => `${n} ${n === 1 ? 'slajd' : n % 10 >= 2 && n % 10 <= 4 && (n % 100 < 12 || n % 100 > 14) ? 'slajdy' : 'slajdów'}`,
  paneLabel: (name) => `Slajdy „${name}”`,
  frameTitle: (name) => `Edytor slajdów: ${name}`,
  opening: 'Otwieranie slajdów…',
  unavailableTitle: 'Edytor slajdów niedostępny',
  unavailableBody: 'Ta wersja CucCut nie zawiera edytora slajdów. Pliki slajdów nadal są w swoim folderze.',
  openFailed: (reason) => `Nie udało się otworzyć slajdów: ${reason}`,
  open: 'Otwórz slajdy',
  openCard: (name) => `Otwórz slajdy „${name}”`,
  openInEditor: 'Otwórz w edytorze slajdów',
  annotate: 'Adnotacje',
  noteLabel: 'Adnotacja',
  notePlaceholder: 'Co zmienić?',
  addToChat: 'Dodaj do czatu',
  cancel: 'Anuluj',
  token: (n) => `Adnotacje do slajdów · ${n}`,
  added: (token) => `Dodano do czatu · ${token}`,
  removeAll: 'Usuń wszystkie adnotacje do slajdów',
  removeOne: (n) => `Usuń adnotację ${n}`,
  item: (n, label, text) => `Adnotacja ${n}, ${label}: ${text}`,
  empty: 'Najpierw napisz adnotację, potem dodaj ją do czatu',
  tooLong: (max) => `Adnotacja może mieć najwyżej ${max} znaków`,
  tooMany: (max) => `Jedna wiadomość może zawierać najwyżej ${max} adnotacji do slajdów. Najpierw wyślij te.`,
  noConversation: 'Ta karta nie należy jeszcze do żadnej sesji. Wyślij wiadomość, aby ją rozpocząć, a potem dodawaj adnotacje.',
  message: 'Popraw slajdy zgodnie z tymi adnotacjami.',
  flushFailed: (names) =>
    `Części zmian w slajdach ${list(names.map((n) => `„${n}”`))} jeszcze nie zapisano, więc wiadomość nie została wysłana. Spróbuj ponownie albo najpierw usuń adnotacje do slajdów.`,
};
