import type { LibraryMessages } from './library-copy.ts';

export const pl: LibraryMessages = {
  blurb: 'Filmy, multimedia i wszystko, co zrobili Twoi agenci, ze wszystkich projektów.',
  blurbProject: 'Filmy, multimedia i wyniki w tym projekcie.',
  blurbFavorite: 'Wszystko, co oznaczono jako ulubione, ze wszystkich projektów.',
  blurbTrash: 'Elementy w koszu czekają tutaj, aż je przywrócisz lub usuniesz trwale.',
  allItems: 'Wszystkie elementy',
  projects: 'Projekty',
  items: (n: number) => `Elementy: ${n}`,
  matching: (n: number, q: string) => `Pasuje do „${q}”: ${n}`,
  kindFilter: 'Rodzaj elementu',
  clearSearch: 'Wyczyść wyszukiwanie',
  noMatchBody: 'Spróbuj innej nazwy lub zmień rodzaj.',
  openHint: 'Otwórz, aby zobaczyć podgląd · Filmy otwierają się w edytorze',
  inProject: (name: string) => `W projekcie ${name}`,
  clearProject: 'Pokaż wszystkie projekty',
  backToLibrary: 'Wróć do biblioteki',
};
