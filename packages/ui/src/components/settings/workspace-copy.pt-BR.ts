import type { WorkspaceMessages } from './workspace-copy.ts';

export const ptBR: WorkspaceMessages = {
  aside: 'Tudo aqui vale para todos os projetos',
  generalBlurb: 'A aparência e o idioma do CucCut, onde os downloads ficam e o que ele pode buscar na internet.',
  shortcutsBlurb: 'Teclas que funcionam em qualquer lugar do CucCut. Os atalhos do editor estão na Ajuda (F1).',
  shortcutsPanel: 'Em qualquer lugar do CucCut',
  fontsBlurb: 'Fontes para legendas e títulos: de onde vêm e as que já estão neste computador.',
  privacyBlurb: 'O que fica neste computador, o que pode ser enviado a provedores na nuvem e o que os agentes podem fazer sem perguntar.',
  diagnosticsBlurb: 'O Runtime local, seus registros e quanto deste computador as tarefas em segundo plano podem usar.',
  aboutBlurb: 'Versões do app, da interface e do Runtime, e como o CucCut se atualiza.',
  checking: 'Verificando…',
  noAgent: 'Nenhum agente pronto',
  shortcutCount: (n) => (n === 1 ? '1 atalho' : `${n} atalhos`),
  skillCount: (n) => (n === 0 ? 'Nenhum ainda' : n === 1 ? '1 skill' : `${n} skills`),
  glossaryCount: (n) => (n === 0 ? 'Nenhum ainda' : n === 1 ? '1 glossário' : `${n} glossários`),
  grantCount: (n) => (n === 0 ? 'Nenhuma autorização ativa' : n === 1 ? '1 autorização ativa' : `${n} autorizações ativas`),
  runtimeOn: 'Runtime conectado',
  runtimeOff: 'Runtime desconectado',
  installed: (n) => (n === 0 ? 'Nenhum instalado' : n === 1 ? '1 instalado' : `${n} instalados`),
  noDefault: 'Sem padrão ainda',
  version: (version) => `Versão ${version}`,
  desktopOnly: 'Só no app para desktop',
  notYet: 'Ainda não disponível',
  loadFailed: 'Não foi possível carregar',
  fontsSummary: 'Para legendas e títulos',
  preferencesSummary: (written, answers) =>
    written
      ? answers === 0
        ? 'Preferências escritas'
        : answers === 1
          ? 'Preferências escritas, 1 resposta'
          : `Preferências escritas, ${answers} respostas`
      : answers === 0
        ? 'Nenhuma preferência ainda'
        : answers === 1
          ? '1 resposta'
          : `${answers} respostas`,
  ruleCount: (n, off) => (n === 0 ? 'Nenhuma ainda' : `${n === 1 ? '1 regra' : `${n} regras`}${off ? `, ${off} desligadas` : ''}`),
  packsBlurb:
    'Um jeito de fazer vídeos que viaja: modelos, habilidades, itens da biblioteca e um guia de estilo em uma pasta. Importe um de uma pasta, do GitHub ou de um endereço web, ou exporte o seu para enviar.',
  packCount: (n: number) => (n === 0 ? 'Nenhum instalado' : n === 1 ? '1 pacote' : `${n} pacotes`),
};
