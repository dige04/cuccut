import type { SlidesMessages } from './slides-copy.ts';

const list = (labels: readonly string[]) => new Intl.ListFormat('ru', { type: 'conjunction' }).format(labels);

export const ru: SlidesMessages = {
  pages: (n) => `${n} ${n % 10 === 1 && n % 100 !== 11 ? 'слайд' : n % 10 >= 2 && n % 10 <= 4 && (n % 100 < 12 || n % 100 > 14) ? 'слайда' : 'слайдов'}`,
  paneLabel: (name) => `Слайды «${name}»`,
  frameTitle: (name) => `Редактор слайдов: ${name}`,
  opening: 'Открытие слайдов…',
  unavailableTitle: 'Редактор слайдов недоступен',
  unavailableBody: 'Эта сборка CucCut не содержит редактор слайдов. Файлы слайдов остаются в своей папке.',
  openFailed: (reason) => `Не удалось открыть слайды: ${reason}`,
  open: 'Открыть слайды',
  openCard: (name) => `Открыть слайды «${name}»`,
  openInEditor: 'Открыть в редакторе слайдов',
  annotate: 'Пометки',
  noteLabel: 'Пометка',
  notePlaceholder: 'Что изменить?',
  addToChat: 'Добавить в чат',
  cancel: 'Отмена',
  token: (n) => `Пометки к слайдам · ${n}`,
  added: (token) => `Добавлено в чат · ${token}`,
  removeAll: 'Убрать все пометки к слайдам',
  removeOne: (n) => `Убрать пометку ${n}`,
  item: (n, label, text) => `Пометка ${n}, ${label}: ${text}`,
  empty: 'Сначала напишите пометку, затем добавьте её в чат',
  tooLong: (max) => `Пометка может быть не длиннее ${max} символов`,
  tooMany: (max) => `К одному сообщению можно приложить не больше ${max} пометок к слайдам. Сначала отправьте эти.`,
  noConversation: 'Эта вкладка ещё не относится к сеансу. Отправьте сообщение, чтобы начать сеанс, затем добавляйте пометки.',
  message: 'Исправь слайды по этим пометкам.',
  flushFailed: (names) =>
    `Изменения в слайдах ${list(names.map((n) => `«${n}»`))} ещё не сохранились, поэтому сообщение не отправлено. Попробуйте ещё раз или сначала уберите пометки к слайдам.`,
};
