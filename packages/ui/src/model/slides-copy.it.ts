import type { SlidesMessages } from './slides-copy.ts';

const list = (labels: readonly string[]) => new Intl.ListFormat('it', { type: 'conjunction' }).format(labels);

export const it: SlidesMessages = {
  pages: (n) => (n === 1 ? '1 diapositiva' : `${n} diapositive`),
  paneLabel: (name) => `Diapositive «${name}»`,
  frameTitle: (name) => `Editor di diapositive: ${name}`,
  opening: 'Apertura delle diapositive…',
  unavailableTitle: 'Editor di diapositive non disponibile',
  unavailableBody: 'Questa versione di CucCut non include l’editor di diapositive. I file delle diapositive sono ancora nella loro cartella.',
  openFailed: (reason) => `Impossibile aprire le diapositive: ${reason}`,
  open: 'Apri diapositive',
  openCard: (name) => `Apri diapositive «${name}»`,
  openInEditor: 'Apri nell’editor di diapositive',
  annotate: 'Annota',
  noteLabel: 'Annotazione',
  notePlaceholder: 'Cosa va cambiato?',
  addToChat: 'Aggiungi alla chat',
  cancel: 'Annulla',
  token: (n) => `Annotazioni sulle diapositive · ${n}`,
  added: (token) => `Aggiunto alla chat · ${token}`,
  removeAll: 'Rimuovi tutte le annotazioni sulle diapositive',
  removeOne: (n) => `Rimuovi l’annotazione ${n}`,
  item: (n, label, text) => `Annotazione ${n}, ${label}: ${text}`,
  empty: 'Scrivi prima l’annotazione, poi aggiungila alla chat',
  tooLong: (max) => `Un’annotazione può avere al massimo ${max} caratteri`,
  tooMany: (max) => `Un messaggio può contenere al massimo ${max} annotazioni sulle diapositive. Invia prima queste.`,
  noConversation: 'Questa scheda non fa ancora parte di una sessione. Invia un messaggio per avviarne una, poi aggiungi le annotazioni.',
  message: 'Rivedi le diapositive secondo queste annotazioni.',
  flushFailed: (names) =>
    `Le modifiche alle diapositive ${list(names.map((n) => `«${n}»`))} non sono ancora state salvate, quindi il messaggio non è stato inviato. Riprova oppure rimuovi prima le annotazioni sulle diapositive.`,
};
