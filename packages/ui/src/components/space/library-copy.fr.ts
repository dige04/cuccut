import type { LibraryMessages } from './library-copy.ts';

export const fr: LibraryMessages = {
  blurb: 'Vidéos, médias et tout ce que vos agents ont produit, dans tous vos projets.',
  blurbProject: 'Vidéos, médias et résultats de ce projet.',
  blurbFavorite: 'Tout ce que vous avez mis en favori, dans tous vos projets.',
  blurbTrash: 'Les éléments de la corbeille restent ici jusqu’à ce que vous les restauriez ou les supprimiez définitivement.',
  allItems: 'Tous les éléments',
  projects: 'Projets',
  items: (n: number) => (n <= 1 ? `${n} élément` : `${n} éléments`),
  matching: (n: number, q: string) => `${n <= 1 ? `${n} élément correspond` : `${n} éléments correspondent`} à « ${q} »`,
  kindFilter: 'Type d’élément',
  clearSearch: 'Effacer la recherche',
  noMatchBody: 'Essayez un autre nom ou changez de type.',
  openHint: 'Ouvrez pour prévisualiser · Les vidéos s’ouvrent dans l’éditeur',
  inProject: (name: string) => `Dans ${name}`,
  clearProject: 'Afficher tous les projets',
  backToLibrary: 'Retour à la bibliothèque',
};
