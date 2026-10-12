import type { CommentLabelMessages } from './comment-labels.ts';

export const es: CommentLabelMessages = {
  kinds: {
    token: 'Token',
    cgroup: 'Grupo de colores',
    tset: 'Conjunto de estilos de texto',
    style: 'Estilo de texto',
    font: 'Fuente',
    knob: 'Ajuste de estilo',
    editor: 'Editor de estilo',
    picker: 'Selector de color',
    prop: 'Propiedad',
    props: 'Propiedades',
    cell: 'Valor de color',
    agroup: 'Grupo de recursos',
    asset: 'Recurso',
    comp: 'Componente',
    doc: 'Documento',
    dialog: 'Diálogo',
    lightbox: 'Vista previa del recurso',
    note: 'Nota de uso',
    page: 'Título de sección',
  },
  specials: {
    cover: 'Portada',
    'font-files': 'Archivos de fuente',
  },
  element: 'Elemento',
  quote: (name) => `“${name}”`,
};
