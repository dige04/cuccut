import type { SlidesMessages } from './slides-copy.ts';

const list = (labels: readonly string[]) => new Intl.ListFormat('pt-BR', { type: 'conjunction' }).format(labels);

export const ptBR: SlidesMessages = {
  pages: (n) => (n === 1 ? '1 slide' : `${n} slides`),
  paneLabel: (name) => `Slides “${name}”`,
  frameTitle: (name) => `Editor de slides: ${name}`,
  opening: 'Abrindo slides…',
  unavailableTitle: 'Editor de slides indisponível',
  unavailableBody: 'Esta versão do CucCut não inclui o editor de slides. Os arquivos dos slides continuam na pasta.',
  openFailed: (reason) => `Não foi possível abrir os slides: ${reason}`,
  open: 'Abrir slides',
  openCard: (name) => `Abrir slides “${name}”`,
  openInEditor: 'Abrir no editor de slides',
  annotate: 'Anotar',
  noteLabel: 'Anotação',
  notePlaceholder: 'O que deve mudar?',
  addToChat: 'Adicionar ao chat',
  cancel: 'Cancelar',
  token: (n) => `Anotações de slides · ${n}`,
  added: (token) => `Adicionado ao chat · ${token}`,
  removeAll: 'Remover todas as anotações de slides',
  removeOne: (n) => `Remover a anotação ${n}`,
  item: (n, label, text) => `Anotação ${n}, ${label}: ${text}`,
  empty: 'Escreva a anotação primeiro e depois adicione ao chat',
  tooLong: (max) => `Uma anotação pode ter no máximo ${max} caracteres`,
  tooMany: (max) => `Uma mensagem pode levar no máximo ${max} anotações de slides. Envie estas primeiro.`,
  noConversation: 'Esta aba ainda não faz parte de uma sessão. Envie uma mensagem para começar uma e depois adicione anotações.',
  message: 'Revise os slides de acordo com estas anotações.',
  flushFailed: (names) =>
    `As alterações nos slides ${list(names.map((n) => `“${n}”`))} ainda não foram salvas, então a mensagem não foi enviada. Tente de novo ou remova antes as anotações dos slides.`,
};
