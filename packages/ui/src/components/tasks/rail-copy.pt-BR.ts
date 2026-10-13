import type { RailMessages } from './rail-copy.ts';

export const ptBR: RailMessages = {
  running: (n: number) => `${n} em andamento`,
  finished: (n: number) => (n === 1 ? '1 concluída' : `${n} concluídas`),
  nothingYet: 'Nada ainda',
  tasksBlurb: 'Transcrição, tradução, exportações e o trabalho dos agentes, em uma só lista. Abra uma tarefa para ver as etapas e os resultados.',
  toolCount: (n: number) => (n === 1 ? '1 ferramenta' : `${n} ferramentas`),
  moreFinished: (n: number) => `Mais ${n} em Todas as tarefas`,
};
