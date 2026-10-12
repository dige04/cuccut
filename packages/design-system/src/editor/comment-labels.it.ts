import type { CommentLabelMessages } from './comment-labels.ts';

export const it: CommentLabelMessages = {
  kinds: {
    token: 'Token',
    cgroup: 'Gruppo di colori',
    tset: 'Set di stili di testo',
    style: 'Stile di testo',
    font: 'Font',
    knob: 'Impostazione di stile',
    editor: 'Editor di stile',
    picker: 'Selettore colore',
    prop: 'Proprietà',
    props: 'Elenco proprietà',
    cell: 'Valore colore',
    agroup: 'Gruppo di risorse',
    asset: 'Risorsa',
    comp: 'Componente',
    doc: 'Documento',
    dialog: 'Finestra di dialogo',
    lightbox: 'Anteprima risorsa',
    note: 'Nota d’uso',
    page: 'Titolo della sezione',
  },
  specials: {
    cover: 'Copertina',
    'font-files': 'File dei font',
  },
  element: 'Elemento',
  quote: (name) => `«${name}»`,
};
