import type { SlidesMessages } from './slides-copy.ts';

const list = (labels: readonly string[]) => new Intl.ListFormat('fr', { type: 'conjunction' }).format(labels);

export const fr: SlidesMessages = {
  pages: (n) => (n === 1 ? '1 diapositive' : `${n} diapositives`),
  paneLabel: (name) => `Diapositives « ${name} »`,
  frameTitle: (name) => `Éditeur de diapositives : ${name}`,
  opening: 'Ouverture des diapositives…',
  unavailableTitle: 'Éditeur de diapositives indisponible',
  unavailableBody: 'Cette version de CucCut ne comprend pas l’éditeur de diapositives. Les fichiers des diapositives restent dans leur dossier.',
  openFailed: (reason) => `Impossible d’ouvrir les diapositives : ${reason}`,
  open: 'Ouvrir les diapositives',
  openCard: (name) => `Ouvrir les diapositives « ${name} »`,
  openInEditor: 'Ouvrir dans l’éditeur de diapositives',
  annotate: 'Annoter',
  noteLabel: 'Annotation',
  notePlaceholder: 'Que faut-il changer ?',
  addToChat: 'Ajouter à la conversation',
  cancel: 'Annuler',
  token: (n) => `Annotations de diapositives · ${n}`,
  added: (token) => `Ajouté à la conversation · ${token}`,
  removeAll: 'Retirer toutes les annotations de diapositives',
  removeOne: (n) => `Retirer l’annotation ${n}`,
  item: (n, label, text) => `Annotation ${n}, ${label} : ${text}`,
  empty: 'Écrivez d’abord l’annotation, puis ajoutez-la à la conversation',
  tooLong: (max) => `Une annotation ne peut pas dépasser ${max} caractères`,
  tooMany: (max) => `Un message peut contenir au plus ${max} annotations de diapositives. Envoyez d’abord celles-ci.`,
  noConversation: 'Cet onglet ne fait pas encore partie d’une session. Envoyez un message pour en démarrer une, puis ajoutez des annotations.',
  message: 'Révise les diapositives selon ces annotations.',
  flushFailed: (names) =>
    `Les modifications des diapositives ${list(names.map((n) => `« ${n} »`))} ne sont pas encore enregistrées : le message n’a pas été envoyé. Réessayez ou retirez d’abord les annotations de diapositives.`,
};
