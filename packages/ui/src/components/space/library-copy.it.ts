import type { LibraryMessages } from './library-copy.ts';

export const it: LibraryMessages = {
  blurb: 'Video, media e tutto ciò che i tuoi agenti hanno creato, da tutti i progetti.',
  blurbProject: 'Video, media e risultati di questo progetto.',
  blurbFavorite: 'Tutto ciò che hai aggiunto ai preferiti, da tutti i progetti.',
  blurbTrash: 'Gli elementi nel Cestino restano qui finché non li ripristini o li elimini definitivamente.',
  allItems: 'Tutti gli elementi',
  projects: 'Progetti',
  items: (n: number) => (n === 1 ? '1 elemento' : `${n} elementi`),
  matching: (n: number, q: string) => `${n === 1 ? '1 elemento corrisponde' : `${n} elementi corrispondono`} a “${q}”`,
  kindFilter: 'Tipo di elemento',
  clearSearch: 'Cancella ricerca',
  noMatchBody: 'Prova un altro nome o cambia tipo.',
  openHint: 'Apri per l’anteprima · I video si aprono nell’editor',
  inProject: (name: string) => `In ${name}`,
  clearProject: 'Mostra tutti i progetti',
  backToLibrary: 'Torna alla libreria',
};
