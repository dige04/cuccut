import type { CommentLabelMessages } from './comment-labels.ts';

export const nl: CommentLabelMessages = {
  kinds: {
    token: 'Token',
    cgroup: 'Kleurgroep',
    tset: 'Tekststijlset',
    style: 'Tekststijl',
    font: 'Lettertype',
    knob: 'Stijlinstelling',
    editor: 'Stijleditor',
    picker: 'Kleurkiezer',
    prop: 'Eigenschap',
    props: 'Eigenschappen',
    cell: 'Kleurwaarde',
    agroup: 'Assetgroep',
    asset: 'Asset',
    comp: 'Component',
    doc: 'Document',
    dialog: 'Dialoogvenster',
    lightbox: 'Assetvoorbeeld',
    note: 'Gebruiksnotitie',
    page: 'Sectietitel',
  },
  specials: {
    cover: 'Omslag',
    'font-files': 'Lettertypebestanden',
  },
  element: 'Element',
  quote: (name) => `“${name}”`,
};
