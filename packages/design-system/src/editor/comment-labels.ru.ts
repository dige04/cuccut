import type { CommentLabelMessages } from './comment-labels.ts';

export const ru: CommentLabelMessages = {
  kinds: {
    token: 'Токен',
    cgroup: 'Группа цветов',
    tset: 'Набор стилей текста',
    style: 'Стиль текста',
    font: 'Шрифт',
    knob: 'Настройка стиля',
    editor: 'Редактор стиля',
    picker: 'Выбор цвета',
    prop: 'Свойство',
    props: 'Свойства',
    cell: 'Значение цвета',
    agroup: 'Группа ресурсов',
    asset: 'Ресурс',
    comp: 'Компонент',
    doc: 'Документ',
    dialog: 'Диалог',
    lightbox: 'Предпросмотр ресурса',
    note: 'Заметка об использовании',
    page: 'Заголовок раздела',
  },
  specials: {
    cover: 'Обложка',
    'font-files': 'Файлы шрифтов',
  },
  element: 'Элемент',
  quote: (name) => `«${name}»`,
};
