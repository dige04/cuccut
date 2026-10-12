import type { DesignSystemMessages } from './design-system-copy.ts';

const list = (labels: readonly string[]) => new Intl.ListFormat('pl', { type: 'conjunction' }).format(labels);

export const pl: DesignSystemMessages = {
  paneLabel: (name) => `System projektowy „${name}”`,
  frameTitle: (name) => `Edytor systemu projektowego: ${name}`,
  opening: 'Otwieranie systemu projektowego…',
  unavailableTitle: 'Edytor systemu projektowego niedostępny',
  unavailableBody: 'Ta wersja CucCut nie zawiera edytora systemu projektowego. Pliki systemu projektowego nadal są w swoim folderze.',
  hostBlockedTitle: 'Edytor systemu projektowego niedostępny pod tym adresem',
  hostBlockedBody: 'Aby edytować systemy projektowe, otwórz CucCut Web pod adresem 127.0.0.1 lub localhost. Pliki systemu projektowego nadal są w swoim folderze.',
  openFailed: (reason) => `Nie udało się otworzyć systemu projektowego: ${reason}`,
  open: 'Otwórz system projektowy',
  openInEditor: 'Otwórz w edytorze systemu projektowego',
  annotate: 'Adnotacje',
  noteLabel: 'Adnotacja',
  notePlaceholder: 'Co zmienić?',
  addToChat: 'Dodaj do czatu',
  cancel: 'Anuluj',
  where: (name, label) => `System projektowy „${name}” › ${label}`,
  token: (n) => `Adnotacje do systemu projektowego · ${n}`,
  added: (token) => `Dodano do czatu · ${token}`,
  removeAll: 'Usuń wszystkie adnotacje do systemu projektowego',
  removeOne: (n) => `Usuń adnotację ${n}`,
  item: (n, label, text) => `Adnotacja ${n}, ${label}: ${text}`,
  empty: 'Najpierw napisz adnotację, potem dodaj ją do czatu',
  tooLong: (max) => `Adnotacja może mieć najwyżej ${max} znaków`,
  tooMany: (max) => `Jedna wiadomość może zawierać najwyżej ${max} adnotacji do systemu projektowego. Najpierw wyślij te.`,
  noConversation: 'Ta karta nie należy jeszcze do żadnej sesji. Wyślij wiadomość, aby ją rozpocząć, a potem dodawaj adnotacje.',
  message: 'Popraw system projektowy zgodnie z tymi adnotacjami.',
  flushFailed: (names) =>
    `Części zmian w ${names.length === 1 ? 'systemie projektowym' : 'systemach projektowych'} ${list(names.map((n) => `„${n}”`))} jeszcze nie zapisano, więc wiadomość nie została wysłana. Spróbuj ponownie albo najpierw usuń adnotacje do systemu projektowego.`,
};
