import type { LibraryMessages } from './library-copy.ts';

export const nl: LibraryMessages = {
  blurb: 'Video’s, media en alles wat je agents hebben gemaakt, uit al je projecten.',
  blurbProject: 'Video’s, media en resultaten in dit project.',
  blurbFavorite: 'Alles wat je als favoriet hebt gemarkeerd, uit al je projecten.',
  blurbTrash: 'Items in de prullenmand blijven hier tot je ze herstelt of permanent verwijdert.',
  allItems: 'Alle items',
  projects: 'Projecten',
  items: (n: number) => (n === 1 ? '1 item' : `${n} items`),
  matching: (n: number, q: string) => `${n === 1 ? '1 item komt' : `${n} items komen`} overeen met ‘${q}’`,
  kindFilter: 'Soort item',
  clearSearch: 'Zoekopdracht wissen',
  noMatchBody: 'Probeer een andere naam of kies een andere soort.',
  openHint: 'Open om te bekijken · Video’s openen in de editor',
  inProject: (name: string) => `In ${name}`,
  clearProject: 'Alle projecten tonen',
  backToLibrary: 'Terug naar bibliotheek',
};
