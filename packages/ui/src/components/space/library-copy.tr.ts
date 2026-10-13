import type { LibraryMessages } from './library-copy.ts';

export const tr: LibraryMessages = {
  blurb: 'Tüm projelerden videolar, medya ve ajanlarınızın ürettiği her şey burada.',
  blurbProject: 'Bu projedeki videolar, medya ve çıktılar.',
  blurbFavorite: 'Tüm projelerden favorilere eklediğiniz her şey.',
  blurbTrash: 'Çöp sepetine taşınan öğeler, geri yükleyene veya kalıcı olarak silene kadar burada kalır.',
  allItems: 'Tüm öğeler',
  projects: 'Projeler',
  items: (n: number) => `${n} öğe`,
  matching: (n: number, q: string) => `“${q}” ile eşleşen ${n} öğe`,
  kindFilter: 'Öğe türü',
  clearSearch: 'Aramayı temizle',
  noMatchBody: 'Başka bir ad deneyin ya da türü değiştirin.',
  openHint: 'Önizlemek için açın · Videolar düzenleyicide açılır',
  inProject: (name: string) => `${name} içinde`,
  clearProject: 'Tüm projeleri göster',
  backToLibrary: 'Kitaplığa dön',
};
