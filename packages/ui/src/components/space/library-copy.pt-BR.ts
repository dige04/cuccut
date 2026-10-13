import type { LibraryMessages } from './library-copy.ts';

export const ptBR: LibraryMessages = {
  blurb: 'Vídeos, mídias e tudo o que seus agentes fizeram, de todos os projetos.',
  blurbProject: 'Vídeos, mídias e resultados deste projeto.',
  blurbFavorite: 'Tudo o que você marcou como favorito, de todos os projetos.',
  blurbTrash: 'Os itens da Lixeira ficam aqui até você restaurá-los ou excluí-los permanentemente.',
  allItems: 'Todos os itens',
  projects: 'Projetos',
  items: (n: number) => (n === 1 ? '1 item' : `${n} itens`),
  matching: (n: number, q: string) => `${n === 1 ? '1 item corresponde' : `${n} itens correspondem`} a “${q}”`,
  kindFilter: 'Tipo de item',
  clearSearch: 'Limpar pesquisa',
  noMatchBody: 'Tente outro nome ou mude o tipo.',
  openHint: 'Abra para visualizar · Vídeos abrem no editor',
  inProject: (name: string) => `Em ${name}`,
  clearProject: 'Mostrar todos os projetos',
  backToLibrary: 'Voltar à biblioteca',
};
