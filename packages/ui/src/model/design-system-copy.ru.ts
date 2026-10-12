import type { DesignSystemMessages } from './design-system-copy.ts';

const list = (labels: readonly string[]) => new Intl.ListFormat('ru', { type: 'conjunction' }).format(labels);

export const ru: DesignSystemMessages = {
  paneLabel: (name) => `Дизайн-система «${name}»`,
  frameTitle: (name) => `Редактор дизайн-систем: ${name}`,
  opening: 'Открытие дизайн-системы…',
  unavailableTitle: 'Редактор дизайн-систем недоступен',
  unavailableBody: 'Эта сборка CucCut не содержит редактор дизайн-систем. Файлы дизайн-системы остаются в своей папке.',
  hostBlockedTitle: 'Редактор дизайн-систем недоступен по этому адресу',
  hostBlockedBody: 'Чтобы редактировать дизайн-системы, откройте CucCut Web по адресу 127.0.0.1 или localhost. Файлы дизайн-системы остаются в своей папке.',
  openFailed: (reason) => `Не удалось открыть дизайн-систему: ${reason}`,
  open: 'Открыть дизайн-систему',
  openInEditor: 'Открыть в редакторе дизайн-систем',
  annotate: 'Пометки',
  noteLabel: 'Пометка',
  notePlaceholder: 'Что изменить?',
  addToChat: 'Добавить в чат',
  cancel: 'Отмена',
  where: (name, label) => `Дизайн-система «${name}» › ${label}`,
  token: (n) => `Пометки к дизайн-системе · ${n}`,
  added: (token) => `Добавлено в чат · ${token}`,
  removeAll: 'Убрать все пометки к дизайн-системе',
  removeOne: (n) => `Убрать пометку ${n}`,
  item: (n, label, text) => `Пометка ${n}, ${label}: ${text}`,
  empty: 'Сначала напишите пометку, затем добавьте её в чат',
  tooLong: (max) => `Пометка может быть не длиннее ${max} символов`,
  tooMany: (max) => `К одному сообщению можно приложить не больше ${max} пометок к дизайн-системе. Сначала отправьте эти.`,
  noConversation: 'Эта вкладка ещё не относится к сеансу. Отправьте сообщение, чтобы начать сеанс, затем добавляйте пометки.',
  message: 'Исправь дизайн-систему по этим пометкам.',
  flushFailed: (names) =>
    `Изменения в дизайн-системе ${list(names.map((n) => `«${n}»`))} ещё не сохранились, поэтому сообщение не отправлено. Попробуйте ещё раз или сначала уберите пометки к дизайн-системе.`,
};
