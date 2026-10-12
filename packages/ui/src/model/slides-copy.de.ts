import type { SlidesMessages } from './slides-copy.ts';

const list = (labels: readonly string[]) => new Intl.ListFormat('de', { type: 'conjunction' }).format(labels);

export const de: SlidesMessages = {
  pages: (n) => (n === 1 ? '1 Folie' : `${n} Folien`),
  paneLabel: (name) => `Folien „${name}“`,
  frameTitle: (name) => `Folieneditor: ${name}`,
  opening: 'Folien werden geöffnet…',
  unavailableTitle: 'Folieneditor nicht verfügbar',
  unavailableBody: 'Diese CucCut-Version enthält den Folieneditor nicht. Die Foliendateien liegen weiterhin in ihrem Ordner.',
  openFailed: (reason) => `Folien konnten nicht geöffnet werden: ${reason}`,
  open: 'Folien öffnen',
  openCard: (name) => `Folien „${name}“ öffnen`,
  openInEditor: 'Im Folieneditor öffnen',
  annotate: 'Anmerken',
  noteLabel: 'Anmerkung',
  notePlaceholder: 'Was soll sich ändern?',
  addToChat: 'Zum Chat hinzufügen',
  cancel: 'Abbrechen',
  token: (n) => `Folienanmerkungen · ${n}`,
  added: (token) => `Zum Chat hinzugefügt · ${token}`,
  removeAll: 'Alle Folienanmerkungen entfernen',
  removeOne: (n) => `Anmerkung ${n} entfernen`,
  item: (n, label, text) => `Anmerkung ${n}, ${label}: ${text}`,
  empty: 'Schreib zuerst eine Anmerkung und füge sie dann zum Chat hinzu',
  tooLong: (max) => `Eine Anmerkung darf höchstens ${max} Zeichen lang sein`,
  tooMany: (max) => `Eine Nachricht kann höchstens ${max} Folienanmerkungen enthalten. Sende diese zuerst.`,
  noConversation: 'Dieser Tab gehört noch zu keiner Sitzung. Sende eine Nachricht, um eine zu starten, und füge dann Anmerkungen hinzu.',
  message: 'Überarbeite die Folien nach diesen Anmerkungen.',
  flushFailed: (names) =>
    `Änderungen an den Folien ${list(names.map((n) => `„${n}“`))} sind noch nicht gespeichert, daher wurde die Nachricht nicht gesendet. Versuche es erneut oder entferne zuerst die Folienanmerkungen.`,
};
