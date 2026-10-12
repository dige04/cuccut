import type { SlidesMessages } from './slides-copy.ts';

const list = (labels: readonly string[]) => new Intl.ListFormat('nl', { type: 'conjunction' }).format(labels);

export const nl: SlidesMessages = {
  pages: (n) => (n === 1 ? '1 dia' : `${n} dia's`),
  paneLabel: (name) => `Dia's ‘${name}’`,
  frameTitle: (name) => `Dia-editor: ${name}`,
  opening: "Dia's openen…",
  unavailableTitle: 'Dia-editor niet beschikbaar',
  unavailableBody: "Deze versie van CucCut bevat de dia-editor niet. De bestanden van de dia's staan nog in hun map.",
  openFailed: (reason) => `Kan dia's niet openen: ${reason}`,
  open: "Dia's openen",
  openCard: (name) => `Dia's ‘${name}’ openen`,
  openInEditor: 'Openen in dia-editor',
  annotate: 'Annoteren',
  noteLabel: 'Annotatie',
  notePlaceholder: 'Wat moet er anders?',
  addToChat: 'Aan chat toevoegen',
  cancel: 'Annuleren',
  token: (n) => `Dia-annotaties · ${n}`,
  added: (token) => `Aan chat toegevoegd · ${token}`,
  removeAll: 'Alle dia-annotaties verwijderen',
  removeOne: (n) => `Annotatie ${n} verwijderen`,
  item: (n, label, text) => `Annotatie ${n}, ${label}: ${text}`,
  empty: 'Schrijf eerst een annotatie en voeg die dan aan de chat toe',
  tooLong: (max) => `Een annotatie mag hoogstens ${max} tekens lang zijn`,
  tooMany: (max) => `Een bericht kan hoogstens ${max} dia-annotaties bevatten. Verstuur deze eerst.`,
  noConversation: 'Dit tabblad hoort nog niet bij een sessie. Stuur een bericht om er een te starten en voeg daarna annotaties toe.',
  message: 'Pas de dia’s aan volgens deze annotaties.',
  flushFailed: (names) =>
    `Wijzigingen in de dia’s ${list(names.map((n) => `‘${n}’`))} zijn nog niet opgeslagen, dus het bericht is niet verzonden. Probeer het opnieuw of verwijder eerst de dia-annotaties.`,
};
