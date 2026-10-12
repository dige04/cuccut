import type { DesignSystemMessages } from './design-system-copy.ts';

const list = (labels: readonly string[]) => new Intl.ListFormat('de', { type: 'conjunction' }).format(labels);

export const de: DesignSystemMessages = {
  paneLabel: (name) => `Designsystem „${name}“`,
  frameTitle: (name) => `Designsystem-Editor: ${name}`,
  opening: 'Designsystem wird geöffnet…',
  unavailableTitle: 'Designsystem-Editor nicht verfügbar',
  unavailableBody: 'Diese CucCut-Version enthält den Designsystem-Editor nicht. Die Dateien des Designsystems liegen weiterhin in ihrem Ordner.',
  hostBlockedTitle: 'Designsystem-Editor unter dieser Adresse nicht verfügbar',
  hostBlockedBody: 'Öffne CucCut Web unter 127.0.0.1 oder localhost, um Designsysteme zu bearbeiten. Die Dateien des Designsystems liegen weiterhin in ihrem Ordner.',
  openFailed: (reason) => `Designsystem konnte nicht geöffnet werden: ${reason}`,
  open: 'Designsystem öffnen',
  openInEditor: 'Im Designsystem-Editor öffnen',
  annotate: 'Anmerken',
  noteLabel: 'Anmerkung',
  notePlaceholder: 'Was soll sich ändern?',
  addToChat: 'Zum Chat hinzufügen',
  cancel: 'Abbrechen',
  where: (name, label) => `Designsystem „${name}“ › ${label}`,
  token: (n) => `Designsystem-Anmerkungen · ${n}`,
  added: (token) => `Zum Chat hinzugefügt · ${token}`,
  removeAll: 'Alle Designsystem-Anmerkungen entfernen',
  removeOne: (n) => `Anmerkung ${n} entfernen`,
  item: (n, label, text) => `Anmerkung ${n}, ${label}: ${text}`,
  empty: 'Schreib zuerst eine Anmerkung und füge sie dann zum Chat hinzu',
  tooLong: (max) => `Eine Anmerkung darf höchstens ${max} Zeichen lang sein`,
  tooMany: (max) => `Eine Nachricht kann höchstens ${max} Designsystem-Anmerkungen enthalten. Sende diese zuerst.`,
  noConversation: 'Dieser Tab gehört noch zu keiner Sitzung. Sende eine Nachricht, um eine zu starten, und füge dann Anmerkungen hinzu.',
  message: 'Überarbeite das Designsystem nach diesen Anmerkungen.',
  flushFailed: (names) =>
    `Änderungen ${names.length === 1 ? 'am Designsystem' : 'an den Designsystemen'} ${list(names.map((n) => `„${n}“`))} sind noch nicht gespeichert, daher wurde die Nachricht nicht gesendet. Versuche es erneut oder entferne zuerst die Designsystem-Anmerkungen.`,
};
