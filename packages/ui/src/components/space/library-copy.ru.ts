import type { LibraryMessages } from './library-copy.ts';

export const ru: LibraryMessages = {
  blurb: 'Видео, медиафайлы и всё, что сделали ваши агенты, из всех проектов.',
  blurbProject: 'Видео, медиафайлы и результаты этого проекта.',
  blurbFavorite: 'Всё, что вы добавили в избранное, из всех проектов.',
  blurbTrash: 'Элементы в корзине хранятся здесь, пока вы их не восстановите или не удалите навсегда.',
  allItems: 'Все элементы',
  projects: 'Проекты',
  items: (n: number) => `Элементов: ${n}`,
  matching: (n: number, q: string) => `Совпадает с «${q}»: ${n}`,
  kindFilter: 'Тип элемента',
  clearSearch: 'Очистить поиск',
  noMatchBody: 'Попробуйте другое название или выберите другой тип.',
  openHint: 'Откройте для просмотра · Видео открываются в редакторе',
  inProject: (name: string) => `В проекте «${name}»`,
  clearProject: 'Показать все проекты',
  backToLibrary: 'Назад в библиотеку',
};
