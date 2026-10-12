import type { DesignSystemMessages } from './design-system-copy.ts';

const list = (labels: readonly string[]) => new Intl.ListFormat('nl', { type: 'conjunction' }).format(labels);

export const nl: DesignSystemMessages = {
  paneLabel: (name) => `Ontwerpsysteem ‘${name}’`,
  frameTitle: (name) => `Ontwerpsysteemeditor: ${name}`,
  opening: 'Ontwerpsysteem openen…',
  unavailableTitle: 'Ontwerpsysteemeditor niet beschikbaar',
  unavailableBody: 'Deze versie van CucCut bevat de ontwerpsysteemeditor niet. De bestanden van het ontwerpsysteem staan nog in hun map.',
  hostBlockedTitle: 'Ontwerpsysteemeditor niet beschikbaar op dit adres',
  hostBlockedBody: 'Open CucCut Web op 127.0.0.1 of localhost om ontwerpsystemen te bewerken. De bestanden van het ontwerpsysteem staan nog in hun map.',
  openFailed: (reason) => `Kan ontwerpsysteem niet openen: ${reason}`,
  open: 'Ontwerpsysteem openen',
  openInEditor: 'Openen in ontwerpsysteemeditor',
  annotate: 'Annoteren',
  noteLabel: 'Annotatie',
  notePlaceholder: 'Wat moet er anders?',
  addToChat: 'Aan chat toevoegen',
  cancel: 'Annuleren',
  where: (name, label) => `Ontwerpsysteem ‘${name}’ › ${label}`,
  token: (n) => `Ontwerpsysteemannotaties · ${n}`,
  added: (token) => `Aan chat toegevoegd · ${token}`,
  removeAll: 'Alle ontwerpsysteemannotaties verwijderen',
  removeOne: (n) => `Annotatie ${n} verwijderen`,
  item: (n, label, text) => `Annotatie ${n}, ${label}: ${text}`,
  empty: 'Schrijf eerst een annotatie en voeg die dan aan de chat toe',
  tooLong: (max) => `Een annotatie mag hoogstens ${max} tekens lang zijn`,
  tooMany: (max) => `Een bericht kan hoogstens ${max} ontwerpsysteemannotaties bevatten. Verstuur deze eerst.`,
  noConversation: 'Dit tabblad hoort nog niet bij een sessie. Stuur een bericht om er een te starten en voeg daarna annotaties toe.',
  message: 'Pas het ontwerpsysteem aan volgens deze annotaties.',
  flushFailed: (names) =>
    `Wijzigingen in ${names.length === 1 ? 'het ontwerpsysteem' : 'de ontwerpsystemen'} ${list(names.map((n) => `‘${n}’`))} zijn nog niet opgeslagen, dus het bericht is niet verzonden. Probeer het opnieuw of verwijder eerst de ontwerpsysteemannotaties.`,
};
