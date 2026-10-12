import type { CommentLabelMessages } from './comment-labels.ts';

export const pl: CommentLabelMessages = {
  kinds: {
    token: 'Token',
    cgroup: 'Grupa kolorów',
    tset: 'Zestaw stylów tekstu',
    style: 'Styl tekstu',
    font: 'Czcionka',
    knob: 'Ustawienie stylu',
    editor: 'Edytor stylu',
    picker: 'Próbnik kolorów',
    prop: 'Właściwość',
    props: 'Właściwości',
    cell: 'Wartość koloru',
    agroup: 'Grupa zasobów',
    asset: 'Zasób',
    comp: 'Komponent',
    doc: 'Dokument',
    dialog: 'Okno dialogowe',
    lightbox: 'Podgląd zasobu',
    note: 'Notatka o użyciu',
    page: 'Tytuł sekcji',
  },
  specials: {
    cover: 'Okładka',
    'font-files': 'Pliki czcionek',
  },
  element: 'Element',
  quote: (name) => `„${name}”`,
};
