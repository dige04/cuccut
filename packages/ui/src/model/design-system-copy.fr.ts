import type { DesignSystemMessages } from './design-system-copy.ts';

const list = (labels: readonly string[]) => new Intl.ListFormat('fr', { type: 'conjunction' }).format(labels);

export const fr: DesignSystemMessages = {
  paneLabel: (name) => `Système de design « ${name} »`,
  frameTitle: (name) => `Éditeur de système de design : ${name}`,
  opening: 'Ouverture du système de design…',
  unavailableTitle: 'Éditeur de système de design indisponible',
  unavailableBody: 'Cette version de CucCut ne comprend pas l’éditeur de système de design. Les fichiers du système de design restent dans leur dossier.',
  hostBlockedTitle: 'L’éditeur de système de design ne peut pas s’ouvrir à cette adresse',
  hostBlockedBody: 'Ouvrez CucCut Web sur 127.0.0.1 ou localhost pour modifier des systèmes de design. Les fichiers du système de design restent dans leur dossier.',
  openFailed: (reason) => `Impossible d’ouvrir le système de design : ${reason}`,
  open: 'Ouvrir le système de design',
  openInEditor: 'Ouvrir dans l’éditeur de système de design',
  annotate: 'Annoter',
  noteLabel: 'Annotation',
  notePlaceholder: 'Que faut-il changer ?',
  addToChat: 'Ajouter à la conversation',
  cancel: 'Annuler',
  where: (name, label) => `Système de design « ${name} » › ${label}`,
  token: (n) => `Annotations du système de design · ${n}`,
  added: (token) => `Ajouté à la conversation · ${token}`,
  removeAll: 'Retirer toutes les annotations du système de design',
  removeOne: (n) => `Retirer l’annotation ${n}`,
  item: (n, label, text) => `Annotation ${n}, ${label} : ${text}`,
  empty: 'Écrivez d’abord l’annotation, puis ajoutez-la à la conversation',
  tooLong: (max) => `Une annotation ne peut pas dépasser ${max} caractères`,
  tooMany: (max) => `Un message peut contenir au plus ${max} annotations du système de design. Envoyez d’abord celles-ci.`,
  noConversation: 'Cet onglet ne fait pas encore partie d’une session. Envoyez un message pour en démarrer une, puis ajoutez des annotations.',
  message: 'Révise le système de design selon ces annotations.',
  flushFailed: (names) =>
    `Les modifications ${names.length === 1 ? 'du système de design' : 'des systèmes de design'} ${list(names.map((n) => `« ${n} »`))} ne sont pas encore enregistrées : le message n’a pas été envoyé. Réessayez ou retirez d’abord les annotations du système de design.`,
};
