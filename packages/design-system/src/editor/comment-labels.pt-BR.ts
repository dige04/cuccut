import type { CommentLabelMessages } from './comment-labels.ts';

export const ptBR: CommentLabelMessages = {
  kinds: {
    token: 'Token',
    cgroup: 'Grupo de cores',
    tset: 'Conjunto de estilos de texto',
    style: 'Estilo de texto',
    font: 'Fonte',
    knob: 'Ajuste de estilo',
    editor: 'Editor de estilo',
    picker: 'Seletor de cor',
    prop: 'Propriedade',
    props: 'Propriedades',
    cell: 'Valor de cor',
    agroup: 'Grupo de recursos',
    asset: 'Recurso',
    comp: 'Componente',
    doc: 'Documento',
    dialog: 'Caixa de diálogo',
    lightbox: 'Prévia do recurso',
    note: 'Nota de uso',
    page: 'Título da seção',
  },
  specials: {
    cover: 'Capa',
    'font-files': 'Arquivos de fonte',
  },
  element: 'Elemento',
  quote: (name) => `“${name}”`,
};
