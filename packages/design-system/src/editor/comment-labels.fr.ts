import type { CommentLabelMessages } from './comment-labels.ts';

export const fr: CommentLabelMessages = {
  kinds: {
    token: 'Jeton',
    cgroup: 'Groupe de couleurs',
    tset: 'Ensemble de styles de texte',
    style: 'Style de texte',
    font: 'Police',
    knob: 'Réglage de style',
    editor: 'Éditeur de style',
    picker: 'Sélecteur de couleur',
    prop: 'Propriété',
    props: 'Propriétés',
    cell: 'Valeur de couleur',
    agroup: 'Groupe de ressources',
    asset: 'Ressource',
    comp: 'Composant',
    doc: 'Document',
    dialog: 'Boîte de dialogue',
    lightbox: 'Aperçu de la ressource',
    note: 'Note d’usage',
    page: 'Titre de section',
  },
  specials: {
    cover: 'Couverture',
    'font-files': 'Fichiers de police',
  },
  element: 'Élément',
  quote: (name) => `« ${name} »`,
};
