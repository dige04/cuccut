import type { RailMessages } from './rail-copy.ts';

export const es: RailMessages = {
  running: (n: number) => `${n} en curso`,
  finished: (n: number) => (n === 1 ? '1 terminada' : `${n} terminadas`),
  nothingYet: 'Nada todavía',
  tasksBlurb: 'Transcripción, traducción, exportaciones y el trabajo de los agentes, en una sola lista. Abre una tarea para ver sus pasos y resultados.',
  toolCount: (n: number) => (n === 1 ? '1 herramienta' : `${n} herramientas`),
  moreFinished: (n: number) => `${n} más en Todas las tareas`,
};
