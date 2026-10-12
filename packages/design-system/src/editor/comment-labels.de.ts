import type { CommentLabelMessages } from './comment-labels.ts';

export const de: CommentLabelMessages = {
  kinds: {
    token: 'Token',
    cgroup: 'Farbgruppe',
    tset: 'Textstil-Set',
    style: 'Textstil',
    font: 'Schrift',
    knob: 'Stileinstellung',
    editor: 'Stil-Editor',
    picker: 'Farbwähler',
    prop: 'Eigenschaft',
    props: 'Eigenschaften',
    cell: 'Farbwert',
    agroup: 'Asset-Gruppe',
    asset: 'Asset',
    comp: 'Komponente',
    doc: 'Dokument',
    dialog: 'Dialog',
    lightbox: 'Asset-Vorschau',
    note: 'Nutzungshinweis',
    page: 'Abschnittstitel',
  },
  specials: {
    cover: 'Titelbild',
    'font-files': 'Schriftdateien',
  },
  element: 'Element',
  quote: (name) => `„${name}“`,
};
