import type { DesignSystemMessages } from './design-system-copy.ts';

const list = (labels: readonly string[]) => new Intl.ListFormat('pt-BR', { type: 'conjunction' }).format(labels);

export const ptBR: DesignSystemMessages = {
  paneLabel: (name) => `Sistema de design “${name}”`,
  frameTitle: (name) => `Editor de sistema de design: ${name}`,
  opening: 'Abrindo sistema de design…',
  unavailableTitle: 'Editor de sistema de design indisponível',
  unavailableBody: 'Esta versão do CucCut não inclui o editor de sistema de design. Os arquivos do sistema de design continuam na pasta.',
  hostBlockedTitle: 'O editor de sistema de design não abre neste endereço',
  hostBlockedBody: 'Abra o CucCut Web em 127.0.0.1 ou localhost para editar sistemas de design. Os arquivos do sistema de design continuam na pasta.',
  openFailed: (reason) => `Não foi possível abrir o sistema de design: ${reason}`,
  open: 'Abrir sistema de design',
  openInEditor: 'Abrir no editor de sistema de design',
  annotate: 'Anotar',
  noteLabel: 'Anotação',
  notePlaceholder: 'O que deve mudar?',
  addToChat: 'Adicionar ao chat',
  cancel: 'Cancelar',
  where: (name, label) => `Sistema de design “${name}” › ${label}`,
  token: (n) => `Anotações do sistema de design · ${n}`,
  added: (token) => `Adicionado ao chat · ${token}`,
  removeAll: 'Remover todas as anotações do sistema de design',
  removeOne: (n) => `Remover a anotação ${n}`,
  item: (n, label, text) => `Anotação ${n}, ${label}: ${text}`,
  empty: 'Escreva a anotação primeiro e depois adicione ao chat',
  tooLong: (max) => `Uma anotação pode ter no máximo ${max} caracteres`,
  tooMany: (max) => `Uma mensagem pode levar no máximo ${max} anotações do sistema de design. Envie estas primeiro.`,
  noConversation: 'Esta aba ainda não faz parte de uma sessão. Envie uma mensagem para começar uma e depois adicione anotações.',
  message: 'Revise o sistema de design de acordo com estas anotações.',
  flushFailed: (names) =>
    `As alterações ${names.length === 1 ? 'no sistema de design' : 'nos sistemas de design'} ${list(names.map((n) => `“${n}”`))} ainda não foram salvas, então a mensagem não foi enviada. Tente de novo ou remova antes as anotações do sistema de design.`,
};
