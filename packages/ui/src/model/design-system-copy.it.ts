import type { DesignSystemMessages } from './design-system-copy.ts';

const list = (labels: readonly string[]) => new Intl.ListFormat('it', { type: 'conjunction' }).format(labels);

export const it: DesignSystemMessages = {
  paneLabel: (name) => `Design system «${name}»`,
  frameTitle: (name) => `Editor di design system: ${name}`,
  opening: 'Apertura del design system…',
  unavailableTitle: 'Editor di design system non disponibile',
  unavailableBody: 'Questa versione di CucCut non include l’editor di design system. I file del design system sono ancora nella loro cartella.',
  hostBlockedTitle: 'L’editor di design system non si apre a questo indirizzo',
  hostBlockedBody: 'Apri CucCut Web su 127.0.0.1 o localhost per modificare i design system. I file del design system sono ancora nella loro cartella.',
  openFailed: (reason) => `Impossibile aprire il design system: ${reason}`,
  open: 'Apri design system',
  openInEditor: 'Apri nell’editor di design system',
  annotate: 'Annota',
  noteLabel: 'Annotazione',
  notePlaceholder: 'Cosa va cambiato?',
  addToChat: 'Aggiungi alla chat',
  cancel: 'Annulla',
  where: (name, label) => `Design system «${name}» › ${label}`,
  token: (n) => `Annotazioni sul design system · ${n}`,
  added: (token) => `Aggiunto alla chat · ${token}`,
  removeAll: 'Rimuovi tutte le annotazioni sul design system',
  removeOne: (n) => `Rimuovi l’annotazione ${n}`,
  item: (n, label, text) => `Annotazione ${n}, ${label}: ${text}`,
  empty: 'Scrivi prima l’annotazione, poi aggiungila alla chat',
  tooLong: (max) => `Un’annotazione può avere al massimo ${max} caratteri`,
  tooMany: (max) => `Un messaggio può contenere al massimo ${max} annotazioni sul design system. Invia prima queste.`,
  noConversation: 'Questa scheda non fa ancora parte di una sessione. Invia un messaggio per avviarne una, poi aggiungi le annotazioni.',
  message: 'Rivedi il design system secondo queste annotazioni.',
  flushFailed: (names) =>
    `Le modifiche ${names.length === 1 ? 'al design system' : 'ai design system'} ${list(names.map((n) => `«${n}»`))} non sono ancora state salvate, quindi il messaggio non è stato inviato. Riprova oppure rimuovi prima le annotazioni sul design system.`,
};
